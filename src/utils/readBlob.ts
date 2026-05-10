import type { ResourceData } from './getSiteResources';
import { APP_NETWORK } from './suiClient';

const MAINNET_AGGREGATOR = 'https://aggregator.walrus-mainnet.walrus.space';

const getAggregatorUrl = (): string => {
  if (APP_NETWORK !== 'mainnet') {
    throw new Error(`Unsupported Walrus Sites network: ${APP_NETWORK}`);
  }
  return MAINNET_AGGREGATOR;
};

const fetchBytes = async (url: string, label: string): Promise<Uint8Array> => {
  const response = await fetch(url);
  if (!response.ok) {
    const status = [response.status, response.statusText]
      .filter(Boolean)
      .join(' ');
    throw new Error(`Failed to fetch ${label}: ${status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
};

export const buildQuiltResourceUrl = (
  aggregator: string,
  resource: Pick<ResourceData, 'blobId' | 'path'>,
): string =>
  `${aggregator}/v1/blobs/by-quilt-id/${encodeURIComponent(
    resource.blobId,
  )}/${encodeURIComponent(resource.path)}`;

export const readBlob = async (
  blobId: string,
  range?: { start: number; end: number },
): Promise<Uint8Array> => {
  const aggregator = getAggregatorUrl();
  const data = await fetchBytes(
    `${aggregator}/v1/blobs/${encodeURIComponent(blobId)}`,
    'blob',
  );
  if (range) {
    return data.slice(range.start, range.end + 1);
  }
  return data;
};

export const readResource = async (
  resource: Pick<ResourceData, 'blobId' | 'path' | 'range' | 'headers'>,
): Promise<Uint8Array> => {
  const isQuiltResource =
    typeof resource.headers?.['x-wal-quilt-patch-internal-id'] === 'string';

  if (!isQuiltResource) {
    return readBlob(resource.blobId, resource.range);
  }

  const aggregator = getAggregatorUrl();
  return fetchBytes(
    buildQuiltResourceUrl(aggregator, resource),
    'quilt resource',
  );
};
