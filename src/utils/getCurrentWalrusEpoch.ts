import { walrus } from '@mysten/walrus';

import { createGrpcClient, Network } from './suiClient';

export const getCurrentWalrusEpoch = async (
  network: Network,
): Promise<number> => {
  const client = createGrpcClient(network).$extend(walrus());

  const state = await client.walrus.systemState();
  return state.committee.epoch;
};
