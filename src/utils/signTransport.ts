import { bcs } from '@mysten/sui/bcs';
import type { IntentScope, Keypair } from '@mysten/sui/cryptography';
import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';

import { encryptBytes } from './gitSigner';

export const SIGN_TRANSPORT_NETWORK = 'devnet';
const SIGN_TRANSPORT_GRPC_URL = 'https://fullnode.devnet.sui.io:443';
const SIGN_TRANSPORT_GQL_URL = 'https://graphql.devnet.sui.io/graphql';
export const SIGN_TRANSPORT_TX_PAGE_SIZE = 50;

export type TransportMessageKind = 'request' | 'response';

export interface TransportTransactionSummary {
  digest: string;
  index: number;
  sequenceNumber: number | null;
}

interface AddressTransactionsResult {
  address: {
    transactions: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      nodes: Array<{
        digest: string;
        effects?: {
          checkpoint?: {
            sequenceNumber: number;
          } | null;
        } | null;
      }>;
    };
  } | null;
}

interface AddressTransactionsVariables {
  address: string;
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
}

interface TransportTransactionPage {
  transactions: TransportTransactionSummary[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
}

interface ParsedTransactionData {
  inputs?: unknown[];
}

interface PureInput {
  $kind?: string;
  Pure?: {
    bytes?: string;
  };
}

interface SendEncryptedResponseArgs {
  ephemeralAddress: string;
  ephemeralKeypair: Keypair;
  pin: string;
  response: {
    intent: IntentScope;
    signature: string;
  };
}

const transportClient = new SuiGrpcClient({
  network: SIGN_TRANSPORT_NETWORK,
  baseUrl: SIGN_TRANSPORT_GRPC_URL,
});

const transportGqlClient = new SuiGraphQLClient({
  network: SIGN_TRANSPORT_NETWORK,
  url: SIGN_TRANSPORT_GQL_URL,
});

const transportMessageKindCache = new Map<string, TransportMessageKind>();

const QUERY_ADDRESS_TRANSACTIONS = `
  query GetAddressTransactions(
    $address: SuiAddress!
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    address(address: $address) {
      transactions(
        first: $first
        after: $after
        last: $last
        before: $before
        relation: AFFECTED
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          digest
          effects {
            checkpoint {
              sequenceNumber
            }
          }
        }
      }
    }
  }
`;

const getTransactionInputs = (txBytes: Uint8Array): unknown[] => {
  const parsed = Transaction.from(txBytes);
  const data = parsed.getData() as ParsedTransactionData;
  return Array.isArray(data.inputs) ? data.inputs : [];
};

const getPureInputBytes = (input: unknown): string | null => {
  const pureInput = input as PureInput;
  return pureInput.$kind === 'Pure' && typeof pureInput.Pure?.bytes === 'string'
    ? pureInput.Pure.bytes
    : null;
};

export const getTransportMessageKind = async (
  digest: string,
): Promise<TransportMessageKind | null> => {
  if (transportMessageKindCache.has(digest)) {
    return transportMessageKindCache.get(digest) ?? null;
  }

  try {
    const txBytes = await fetchTransportTxBcs(digest);
    const firstBytes = getPureInputBytes(getTransactionInputs(txBytes)[0]);
    if (!firstBytes) return null;

    const kind = bcs.bool().parse(fromBase64(firstBytes))
      ? 'request'
      : 'response';
    transportMessageKindCache.set(digest, kind);
    return kind;
  } catch {
    return null;
  }
};

export const getTransportTransactionPage = async (
  variables: AddressTransactionsVariables,
): Promise<TransportTransactionPage> => {
  const r = await transportGqlClient.query<
    AddressTransactionsResult,
    AddressTransactionsVariables
  >({
    query: QUERY_ADDRESS_TRANSACTIONS,
    variables,
  });

  if (r.errors?.length) {
    throw new Error(
      `Failed to load transport transactions: ${JSON.stringify(r.errors)}`,
    );
  }

  const connection = r.data?.address?.transactions;
  const seen = new Set<string>();
  const transactions = (connection?.nodes ?? [])
    .map((node, index) => ({
      digest: node.digest,
      index,
      sequenceNumber: node.effects?.checkpoint?.sequenceNumber ?? null,
    }))
    .filter((tx) => {
      if (seen.has(tx.digest)) return false;
      seen.add(tx.digest);
      return true;
    })
    .sort((a, b) => {
      if (a.sequenceNumber !== null && b.sequenceNumber !== null) {
        return a.sequenceNumber - b.sequenceNumber;
      }
      if (a.sequenceNumber !== null) return -1;
      if (b.sequenceNumber !== null) return 1;
      return a.index - b.index;
    });

  return {
    transactions,
    pageInfo: connection?.pageInfo ?? {
      hasNextPage: false,
      endCursor: null,
    },
  };
};

export const getLatestTransportTransactions = async (
  address: string,
): Promise<TransportTransactionSummary[]> => {
  const page = await getTransportTransactionPage({
    address,
    last: SIGN_TRANSPORT_TX_PAGE_SIZE,
  });
  return page.transactions;
};

export const fetchTransportTxBcs = async (
  digest: string,
): Promise<Uint8Array> => {
  const result = await transportClient.getTransaction({
    digest,
    include: { bcs: true },
  });
  const tx =
    result.$kind === 'Transaction'
      ? result.Transaction
      : result.FailedTransaction;

  if (tx.bcs instanceof Uint8Array && tx.bcs.length > 0) {
    return tx.bcs;
  }

  throw new Error(
    `Transport transaction BCS not found (network=${SIGN_TRANSPORT_NETWORK}, digest=${digest})`,
  );
};

export const sendEncryptedResponse = async ({
  ephemeralAddress,
  ephemeralKeypair,
  pin,
  response,
}: SendEncryptedResponseArgs): Promise<string> => {
  const tx = new Transaction();
  tx.setSender(ephemeralAddress);
  tx.setGasBudget(10000000);

  const payload = new TextEncoder().encode(JSON.stringify(response));
  const encrypted = await encryptBytes(payload, pin);

  tx.pure.bool(false);
  tx.pure.vector('u8', fromBase64(encrypted));
  tx.transferObjects([tx.gas], ephemeralAddress);

  const result = await transportClient.signAndExecuteTransaction({
    transaction: await tx.build({ client: transportClient }),
    signer: ephemeralKeypair,
  });

  if (result.$kind === 'FailedTransaction') {
    throw new Error(
      `Signed response transaction failed: ${result.FailedTransaction.digest}`,
    );
  }

  const digest = result.Transaction.digest;
  await transportClient.waitForTransaction({ digest });
  return digest;
};
