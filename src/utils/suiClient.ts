import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { SuiGrpcClient } from '@mysten/sui/grpc';

export type Network = 'mainnet' | 'testnet' | 'devnet';

/**
 * Canonical gRPC fullnode URLs per network.
 * Used by all backend utilities that need a SuiGrpcClient.
 */
export const GRPC_URLS: Record<Network, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
};

/**
 * Canonical GraphQL API URLs per network.
 * Used as the fallback stage in two-stage loaders and for queries
 * that have no gRPC equivalent (e.g. events, transaction history).
 */
export const GQL_URLS: Record<Network, string> = {
  mainnet: 'https://graphql.mainnet.sui.io/graphql',
  testnet: 'https://graphql.testnet.sui.io/graphql',
  devnet: 'https://graphql.devnet.sui.io/graphql',
};

/**
 * Create a SuiGrpcClient for the given network using the canonical URL.
 * Pass this directly to `.$extend(walrus())` / `.$extend(suins())` as needed.
 */
export function createGrpcClient(network: Network): SuiGrpcClient {
  return new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] });
}

/**
 * Create a SuiGraphQLClient for the given network using the canonical URL.
 * Used for GraphQL fallback stage in two-stage loaders.
 */
export function createGraphQLClient(network: Network): SuiGraphQLClient {
  return new SuiGraphQLClient({ network, url: GQL_URLS[network] });
}
