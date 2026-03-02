import { walrus } from '@mysten/walrus';

import { loadSiteConfig } from './loadSiteConfig';
import { createGrpcClient, Network } from './suiClient';

// Chain-fixed flow: network is loaded from app site config (caller-provided context via config).
export const getCurrentWalrusEpoch = async (
  network: Network,
): Promise<number> => {
  const config = await loadSiteConfig();
  const net = (config?.network ?? network) as Network;

  const client = createGrpcClient(net).$extend(walrus());

  const state = await client.walrus.systemState();
  return state.committee.epoch;
};
