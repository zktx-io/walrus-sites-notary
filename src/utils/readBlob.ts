import { loadSiteConfig } from './loadSiteConfig';

// Small in-memory cache to avoid refetching identical blob ranges.
const blobCache = new Map<string, Promise<Uint8Array>>();

export const readBlob = async (
  blobId: string,
  range?: { start: number; end: number },
): Promise<Uint8Array> => {
  const cacheKey = range
    ? `${blobId}:${range.start}-${range.end}`
    : `${blobId}:full`;

  if (blobCache.has(cacheKey)) {
    return blobCache.get(cacheKey)!;
  }

  const promise = (async () => {
    const config = await loadSiteConfig();
    const network = config?.network ?? 'testnet';
    const AGGREGATOR =
      network === 'mainnet'
        ? 'https://aggregator.walrus-mainnet.walrus.space'
        : 'https://aggregator.walrus-testnet.walrus.space';

    // Prefer HTTP range requests when a slice is requested; fall back to full fetch if unsupported.
    const url = `${AGGREGATOR}/v1/blobs/${blobId}`;
    const headers = range
      ? { Range: `bytes=${range.start}-${range.end}` }
      : undefined;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      if (range) {
        // Retry without range in case the aggregator ignored/denied the header.
        const retry = await fetch(url);
        if (!retry.ok) {
          throw new Error(`Failed to fetch blob: ${retry.statusText}`);
        }
        const retryData = new Uint8Array(await retry.arrayBuffer());
        return retryData.slice(range.start, range.end + 1);
      }

      throw new Error(`Failed to fetch blob: ${response.statusText}`);
    }

    const data = new Uint8Array(await response.arrayBuffer());

    // If the server ignores Range (status 200), we still slice locally to keep the caller contract.
    if (range) {
      return data.slice(range.start, range.end + 1);
    }

    return data;
  })();

  blobCache.set(cacheKey, promise);

  try {
    const data = await promise;
    return data;
  } catch (error) {
    blobCache.delete(cacheKey);
    throw error;
  }
};
