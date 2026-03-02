import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';
import { blake2b } from '@noble/hashes/blake2b';
import { sha256 } from '@noble/hashes/sha256';

import { JsonLPayload } from './parseJsonl';
import { createGrpcClient, createGraphQLClient, Network } from './suiClient';

const createDigest = (modules: string[], dependencies: string[]) => {
  const items = [];

  for (const base64 of modules) {
    const digest = blake2b(fromBase64(base64), { dkLen: 32 });
    items.push(digest);
  }

  for (const depId of dependencies) {
    // Dependencies are ObjectIDs as hex strings (0x-prefixed, 32 bytes).
    // Decode as raw bytes to match Sui CLI package digest computation.
    const hex = depId.startsWith('0x') ? depId.slice(2) : depId;
    const bytes = new Uint8Array(
      (hex.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16)),
    );
    items.push(bytes);
  }

  items.sort((a, b) => {
    for (let i = 0; i < 32; i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
  });

  const hasher = blake2b.create({ dkLen: 32 });
  for (const item of items) {
    hasher.update(item);
  }

  return hasher.digest();
};

const verification = (
  modules: string[],
  dependencies: string[],
  provenance: JsonLPayload,
): boolean => {
  const digest: number[] = Array.from(createDigest(modules, dependencies));

  // sha256 of bytecode.dump.json content (same format as sui move build --dump-bytecode-as-base64 output).
  // Provenance records sha256 as hex string.
  const rawHash = sha256(
    `${JSON.stringify({ modules, dependencies, digest })}\n`,
  );
  const hashHex = Array.from(rawHash)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return provenance.subject.some(
    (s: { name: string; digest: { sha256: string } }) =>
      s.name === 'bytecode.dump.json' && s.digest.sha256 === hashHex,
  );
};

// Two-stage loader for digest-based transaction loading.
// Network is caller-provided (verifyBytecode only supports mainnet - chain-fixed flow).
// Rationale: bytecode verification is always against the mainnet deployment digest.
async function fetchTxBcsBytes(
  network: Network,
  digest: string,
): Promise<{
  rawTransaction: Uint8Array;
  createdObjects: { owner: string; reference: { objectId: string } }[];
}> {
  const grpcClient = createGrpcClient(network);
  let grpcReason: unknown = 'miss';

  // Stage 1: gRPC
  try {
    const result = await grpcClient.getTransaction({
      digest,
      include: { bcs: true, effects: true },
    });
    const tx =
      result.$kind === 'Transaction'
        ? result.Transaction
        : result.FailedTransaction;
    if (tx.bcs instanceof Uint8Array && tx.bcs.length > 0) {
      // Extract created objects from effects if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const changedObjects = (tx.effects as any)?.changedObjects ?? [];
      type ChangedObject = {
        idOperation: string;
        outputOwner: string;
        objectId?: string;
        id?: string;
      };
      const createdObjects = (changedObjects as ChangedObject[])
        .filter(
          (o) => o.idOperation === 'Created' && o.outputOwner === 'Immutable',
        )
        .map((o) => ({
          owner: 'Immutable',
          reference: { objectId: o.objectId ?? o.id ?? '' },
        }));
      return { rawTransaction: tx.bcs, createdObjects };
    }
    grpcReason = 'empty bcs';
  } catch (e) {
    grpcReason = e;
  }

  // Stage 2: GraphQL fallback
  const GET_TX_QUERY = `
    query GetTxForVerify($digest: String!) {
      transaction(digest: $digest) {
        transactionBcs
        effects {
          objectChanges {
            nodes {
              idCreated
              outputState {
                address
                owner {
                  __typename
                  ... on Immutable {
                    _: __typename
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  const gqlClient = createGraphQLClient(network);
  const r = await gqlClient.query<
    {
      transaction: {
        transactionBcs: string;
        effects: {
          objectChanges: {
            nodes: {
              idCreated: boolean;
              outputState: {
                address: string;
                owner: { __typename: string } | null;
              } | null;
            }[];
          };
        };
      } | null;
    },
    { digest: string }
  >({ query: GET_TX_QUERY, variables: { digest } });

  // Check errors before data per policy.
  if (r.errors?.length) {
    throw new Error(
      `[loader][graphql] errors (network=${network}, stage=graphql, digest=${digest}): ${JSON.stringify(r.errors)}`,
    );
  }

  const txData = r.data?.transaction;
  if (!txData?.transactionBcs) {
    throw new Error(
      `[loader] transaction not found/pruned (network=${network}, digest=${digest}) after grpc->graphql fallback; grpc=${String(grpcReason)}, graphql=null`,
    );
  }

  const rawTransaction = fromBase64(txData.transactionBcs);
  // objectChanges is a connection type - access via nodes per policy.
  const createdObjects = (
    txData.effects?.objectChanges?.nodes ??
    ([] as {
      idCreated: boolean;
      outputState?: { owner?: { __typename: string }; address: string };
    }[])
  )
    .filter(
      (n) => n.idCreated && n.outputState?.owner?.__typename === 'Immutable',
    )
    .map((n) => ({
      owner: 'Immutable' as const,
      reference: { objectId: n.outputState!.address },
    }));

  return { rawTransaction, createdObjects };
}

// TODO[Gate-F]: This file uses two-stage loader with GraphQL transactionBcs and objectChanges.nodes.
// objectChanges is treated as a connection type (nodes access) per policy.
// Runtime validation required: schema introspection, query smoke check, fallback-path execution.

export const verifyBytecode = async (
  packageAddress: string,
  digest: string,
  provenance: JsonLPayload,
): Promise<boolean> => {
  // Chain-fixed: verifyBytecode always operates on mainnet.
  // Rationale: bytecode verification and provenance attestation are mainnet-specific operations.
  const network: Network = 'mainnet';

  const { rawTransaction, createdObjects } = await fetchTxBcsBytes(
    network,
    digest,
  );

  if (createdObjects.length === 0) {
    return false;
  }

  const immutables = createdObjects.find((o) => o.owner === 'Immutable');

  if (!immutables) {
    return false;
  }

  if (immutables.reference.objectId !== packageAddress) {
    return false;
  }

  // rawTransaction is already TransactionData BCS (byte[0]=0x00 = V1 tag).
  const transaction = Transaction.from(rawTransaction);
  const data = transaction.getData();

  const upgrade = data.commands.find((c) => c.$kind === 'Upgrade');
  const publish = data.commands.find((c) => c.$kind === 'Publish');

  if (upgrade && upgrade.Upgrade) {
    return verification(
      upgrade.Upgrade['modules'],
      upgrade.Upgrade['dependencies'],
      provenance,
    );
  }

  if (publish && publish.Publish) {
    return verification(
      publish.Publish['modules'],
      publish.Publish['dependencies'],
      provenance,
    );
  }

  return false;
};
