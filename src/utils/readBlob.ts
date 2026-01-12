import { loadSiteConfig } from './loadSiteConfig';

export const readBlob = async (
  blobId: string,
  range?: { start: number; end: number },
): Promise<Uint8Array> => {
  const config = await loadSiteConfig();
  const AGGREGATOR =
    (config ? config.network : 'testnet') === 'mainnet'
      ? 'https://aggregator.walrus-mainnet.walrus.space'
      : 'https://aggregator.walrus-testnet.walrus.space';
  const response = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch blob: ${response.statusText}`);
  }
  const data = new Uint8Array(await response.arrayBuffer());
  if (range) {
    return data.slice(range.start, range.end + 1);
  }
  return data;
};