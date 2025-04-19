import { NETWORK } from '../NETWORK';

export const readBlob = async (
  blobId: string,
  range?: { start: number; end: number },
): Promise<Uint8Array> => {
  const AGGREGATOR =
    NETWORK === 'mainnet'
      ? 'https://aggregator.walrus-mainnet.walrus.space'
      : 'https://aggregator.walrus-testnet.walrus.space';
  const response = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch blob: ${response.statusText}`);
  }
  const data = await response.bytes();
  if (range) {
    return data.slice(range.start, range.end);
  }
  return data;
};
