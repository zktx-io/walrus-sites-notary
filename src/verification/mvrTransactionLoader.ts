import { fromBase64 } from '@mysten/sui/utils';

import {
  createGraphQLClient,
  createGrpcClient,
  Network,
} from '../utils/suiClient';

import { isSameSuiObjectId } from './mvrObjectId';

export interface LoadedDeploymentTransaction {
  rawTransactionBytes: Uint8Array;
  createdImmutableAddresses: string[];
}

interface GraphQLObjectChangeNode {
  idCreated: boolean;
  outputState: {
    address: string;
    owner: { __typename: string } | null;
  } | null;
}

interface GraphQLTransactionResponse {
  transaction: {
    transactionBcs: string;
    effects: {
      objectChanges: {
        nodes: GraphQLObjectChangeNode[];
      };
    };
  } | null;
}

interface ChangedObject {
  idOperation: string;
  outputOwner: string;
  objectId?: string;
  id?: string;
}

interface GrpcTransactionClient {
  getTransaction(input: {
    digest: string;
    include: { bcs: boolean; effects: boolean };
  }): Promise<{
    $kind: 'Transaction' | 'FailedTransaction';
    Transaction?: { bcs?: Uint8Array; effects?: unknown };
    FailedTransaction?: { bcs?: Uint8Array; effects?: unknown };
  }>;
}

interface GraphQLClient {
  query(input: {
    query: string;
    variables: { digest: string };
  }): Promise<{ data?: unknown; errors?: unknown[] }>;
}

interface DeploymentTransactionLoaderDeps {
  createGrpcClient?: (network: Network) => GrpcTransactionClient;
  createGraphQLClient?: (network: Network) => GraphQLClient;
  cache?: Map<string, LoadedDeploymentTransaction>;
}

const deploymentTransactionCache = new Map<string, LoadedDeploymentTransaction>();

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

const cacheKey = (network: Network, txDigest: string) =>
  `${network}:${txDigest}`;

const cloneLoadedTransaction = (
  transaction: LoadedDeploymentTransaction,
): LoadedDeploymentTransaction => ({
  rawTransactionBytes: new Uint8Array(transaction.rawTransactionBytes),
  createdImmutableAddresses: [...transaction.createdImmutableAddresses],
});

const extractGrpcCreatedImmutableAddresses = (effects: unknown): string[] => {
  const changedObjects = (effects as { changedObjects?: ChangedObject[] } | null)
    ?.changedObjects;

  if (!Array.isArray(changedObjects)) return [];

  return changedObjects
    .filter(
      (object) =>
        object.idOperation === 'Created' && object.outputOwner === 'Immutable',
    )
    .map((object) => object.objectId ?? object.id)
    .filter((objectId): objectId is string => Boolean(objectId));
};

const extractGraphQLCreatedImmutableAddresses = (
  nodes: GraphQLObjectChangeNode[],
): string[] =>
  nodes
    .filter(
      (node) =>
        node.idCreated && node.outputState?.owner?.__typename === 'Immutable',
    )
    .map((node) => node.outputState?.address)
    .filter((address): address is string => Boolean(address));

const readGrpcTransaction = async (
  network: Network,
  txDigest: string,
  grpcClientFactory: (network: Network) => GrpcTransactionClient,
): Promise<LoadedDeploymentTransaction | null> => {
  const result = await grpcClientFactory(network).getTransaction({
    digest: txDigest,
    include: { bcs: true, effects: true },
  });
  const tx =
    result.$kind === 'Transaction'
      ? result.Transaction
      : result.FailedTransaction;

  if (!(tx?.bcs instanceof Uint8Array) || tx.bcs.length === 0) {
    return null;
  }

  return {
    rawTransactionBytes: tx.bcs,
    createdImmutableAddresses: extractGrpcCreatedImmutableAddresses(
      tx.effects,
    ),
  };
};

const readGraphQLTransaction = async (
  network: Network,
  txDigest: string,
  grpcReason: unknown,
  graphQLClientFactory: (network: Network) => GraphQLClient,
): Promise<LoadedDeploymentTransaction> => {
  const response = await graphQLClientFactory(network).query({
    query: GET_TX_QUERY,
    variables: { digest: txDigest },
  });

  if (response.errors?.length) {
    throw new Error(
      `[loader][graphql] errors (network=${network}, stage=graphql, digest=${txDigest}): ${JSON.stringify(response.errors)}`,
    );
  }

  const txData = (response.data as GraphQLTransactionResponse | undefined)
    ?.transaction;
  if (!txData?.transactionBcs) {
    throw new Error(
      `[loader] transaction not found/pruned (network=${network}, digest=${txDigest}) after grpc->graphql fallback; grpc=${String(grpcReason)}, graphql=null`,
    );
  }

  return {
    rawTransactionBytes: fromBase64(txData.transactionBcs),
    createdImmutableAddresses: extractGraphQLCreatedImmutableAddresses(
      txData.effects?.objectChanges?.nodes ?? [],
    ),
  };
};

export const createDeploymentTransactionLoader = ({
  createGrpcClient: grpcClientFactory = createGrpcClient,
  createGraphQLClient: graphQLClientFactory = createGraphQLClient,
  cache = deploymentTransactionCache,
}: DeploymentTransactionLoaderDeps = {}) => {
  return async (
    network: Network,
    txDigest: string,
  ): Promise<LoadedDeploymentTransaction> => {
    const key = cacheKey(network, txDigest);
    const cached = cache.get(key);
    if (cached) return cloneLoadedTransaction(cached);

    let grpcReason: unknown = 'miss';

    try {
      const grpcResult = await readGrpcTransaction(
        network,
        txDigest,
        grpcClientFactory,
      );
      if (grpcResult) {
        cache.set(key, cloneLoadedTransaction(grpcResult));
        return grpcResult;
      }

      grpcReason = 'empty bcs';
    } catch (error) {
      grpcReason = error;
    }

    const graphQLResult = await readGraphQLTransaction(
      network,
      txDigest,
      grpcReason,
      graphQLClientFactory,
    );
    cache.set(key, cloneLoadedTransaction(graphQLResult));
    return graphQLResult;
  };
};

export const loadDeploymentTransaction = createDeploymentTransactionLoader();

export const hasCreatedImmutableAddress = (
  loadedTransaction: Pick<
    LoadedDeploymentTransaction,
    'createdImmutableAddresses'
  >,
  packageAddress: string,
): boolean =>
  loadedTransaction.createdImmutableAddresses.some((address) =>
    isSameSuiObjectId(address, packageAddress),
  );
