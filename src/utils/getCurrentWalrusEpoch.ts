import { SuiClient } from '@mysten/sui/client';
import { WalrusClient } from '@mysten/walrus';

import { loadSiteConfig } from './loadSiteConfig';

export const getCurrentWalrusEpoch = async (
  client: SuiClient,
): Promise<number> => {
  const config = await loadSiteConfig();
  const walrusClient = new WalrusClient({
    network: config?.network ?? 'testnet',
    suiClient: client,
  });
  const state = await walrusClient.systemState();
  return state.committee.epoch;
};
