import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';

import { createGrpcClient, createGraphQLClient, Network } from './suiClient';

// Two-stage loader for digest-based transaction loading.
// Network is received from caller (not a module-scope hardcoded literal).
// Stage 1: gRPC getTransaction; Stage 2: GraphQL fallback; explicit error when both miss.
async function fetchTransactionBcsBytes(
  network: Network,
  digest: string,
): Promise<Uint8Array> {
  const grpcClient = createGrpcClient(network);
  let grpcReason: unknown = 'miss';

  // Stage 1
  try {
    const result = await grpcClient.getTransaction({
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
    grpcReason = 'empty bcs';
  } catch (e) {
    grpcReason = e;
  }

  // Stage 2: GraphQL fallback
  const GET_TX_BCS = `
    query GetTxBcs($digest: String!) {
      transaction(digest: $digest) {
        transactionBcs
      }
    }
  `;
  const gqlClient = createGraphQLClient(network);
  const r = await gqlClient.query<
    { transaction: { transactionBcs: string } | null },
    { digest: string }
  >({ query: GET_TX_BCS, variables: { digest } });

  // Check errors before data per policy.
  if (r.errors?.length) {
    throw new Error(
      `[loader][graphql] errors (network=${network}, stage=graphql, digest=${digest}): ${JSON.stringify(r.errors)}`,
    );
  }
  const bcs64 = r.data?.transaction?.transactionBcs;
  if (!bcs64) {
    throw new Error(
      `[loader] transaction not found/pruned (network=${network}, digest=${digest}) after grpc->graphql fallback; grpc=${String(grpcReason)}, graphql=null`,
    );
  }
  return fromBase64(bcs64);
}

// TODO[Gate-F]: This file uses a two-stage loader with GraphQL transactionBcs field.
// Runtime validation required: schema introspection, query smoke check, fallback-path execution.

export const getPackageCreationTransaction = async (
  packageId: string,
  network: Network = 'mainnet',
): Promise<string> => {
  // Network is caller-provided. This flow is used for package lookups across networks.
  const grpcClient = createGrpcClient(network);

  // getObject in 2.x uses objectId (not id) and returns { object: Object<Include> }.
  const response = await grpcClient.getObject({
    objectId: packageId,
    include: {
      previousTransaction: true,
    },
  });

  const txDigest = response.object?.previousTransaction;

  if (!txDigest) {
    throw new Error('Previous transaction not available for this package');
  }

  // Two-stage loader: gRPC first, GraphQL fallback.
  const bcsBytes = await fetchTransactionBcsBytes(network, txDigest);

  // Parse the transaction to verify the package was created.
  // gRPC tx.bcs is already pure TransactionData BCS — no envelope prefix to strip.
  const transaction = Transaction.from(bcsBytes);
  const data = transaction.getData();

  // Check that a Publish command exists in the transaction.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commands = (data as any).commands ?? [];
  const publish = commands.find(
    (c: { $kind: string }) => c.$kind === 'Publish',
  );
  const upgrade = commands.find(
    (c: { $kind: string }) => c.$kind === 'Upgrade',
  );

  if (!publish && !upgrade) {
    throw new Error(
      'Resolved transaction does not create the requested package',
    );
  }

  return txDigest;
};
