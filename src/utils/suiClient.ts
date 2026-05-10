import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { SuiGrpcClient } from '@mysten/sui/grpc';

export type Network = 'mainnet';

export const APP_NETWORK: Network = 'mainnet';
export const GRPC_URL = 'https://fullnode.mainnet.sui.io:443';
export const GQL_URL = 'https://graphql.mainnet.sui.io/graphql';

/**
 * Canonical gRPC fullnode client for the hosted mainnet app.
 */
export function createGrpcClient(
  network: Network = APP_NETWORK,
): SuiGrpcClient {
  return new SuiGrpcClient({ network, baseUrl: GRPC_URL });
}

/**
 * Canonical GraphQL client for mainnet fallback queries.
 */
export function createGraphQLClient(
  network: Network = APP_NETWORK,
): SuiGraphQLClient {
  return new SuiGraphQLClient({ network, url: GQL_URL });
}
