import {
  DynamicFieldInfo,
  getFullnodeUrl,
  MoveValue,
  MultiGetObjectsParams,
  SuiClient,
  SuiParsedData,
} from '@mysten/sui/client';
import { toBase64, toHex } from '@mysten/sui/utils';
import { SuinsClient } from '@mysten/suins';

import { getCurrentWalrusEpoch } from './getCurrentWalrusEpoch';
import { loadSiteConfig } from './loadSiteConfig';

const OBJECTSIZE = 50;

export interface OwnedBlob {
  objectId: string;
  deletable: boolean;
  endEpoch?: number;
  startEpoch?: number;
  storageSize?: string;
}

const bigintToBase64UrlLE = (num: string): string => {
  const bytes = new Uint8Array(32);

  let temp = BigInt(num);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number(temp & 0xffn);
    temp >>= 8n;
  }

  return toBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const bigintToHexLE = (num: string): string => {
  const bytes = new Uint8Array(32);

  let temp = BigInt(num);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number(temp & 0xffn);
    temp >>= 8n;
  }

  return toHex(bytes);
};

const getMoveField = (
  content: SuiParsedData | undefined,
  key: string,
): string => {
  if (content && content.dataType === 'moveObject' && content.fields !== null) {
    return (content.fields as Record<string, MoveValue>)[key] as string;
  }
  return '';
};

type BlobStorageFields = {
  start_epoch?: number | string;
  end_epoch?: number | string;
  storage_size?: string | number;
};

type BlobFields = {
  blob_id?: string | number;
  deletable?: boolean;
  storage?: { fields?: BlobStorageFields };
};

const isMoveObject = (
  content: SuiParsedData | null | undefined,
): content is SuiParsedData & {
  dataType: 'moveObject';
  type: string;
  fields: BlobFields;
} => {
  return !!content && content.dataType === 'moveObject';
};

const toNum = (v?: number | string): number | undefined =>
  typeof v === 'number'
    ? v
    : typeof v === 'string' && v !== ''
      ? Number(v)
      : undefined;

const toStr = (v?: number | string): string | undefined =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined;

const getAllOwnedObjects = async (
  client: SuiClient,
  owner: string,
): Promise<{ [blobId: string]: OwnedBlob }> => {
  const out: { [blobId: string]: OwnedBlob } = {};
  let cursor: string | null = null;

  for (;;) {
    const page = await client.getOwnedObjects({
      owner,
      cursor,
      limit: 50,
      options: { showContent: true },
    });

    for (const item of page.data) {
      const obj = item.data;
      if (!obj) continue;

      const c = obj.content;
      if (!isMoveObject(c)) continue;
      if (!c.type.endsWith('::blob::Blob') && !c.type.endsWith('::blobs::Blob'))
        continue;

      const rawBlobId = toStr(c.fields.blob_id);
      if (!rawBlobId) continue;

      const s = c.fields.storage?.fields;
      const blobId = bigintToBase64UrlLE(rawBlobId);
      out[blobId] = {
        objectId: obj.objectId,
        deletable: Boolean(c.fields.deletable),
        startEpoch: toNum(s?.start_epoch),
        endEpoch: toNum(s?.end_epoch),
        storageSize: toStr(s?.storage_size),
      };
    }

    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return out;
};

const getAllDynamicFields = async (
  client: SuiClient,
  parentId: string,
): Promise<string[]> => {
  const allFields: DynamicFieldInfo[] = [];
  let cursor: string | null = null;

  while (true) {
    const page = await client.getDynamicFields({
      parentId,
      cursor,
      limit: 50,
    });
    allFields.push(...page.data);
    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return allFields
    .filter((item) => item.objectType.endsWith('::site::Resource'))
    .map((item) => item.objectId);
};

interface ResourceData {
  id: string;
  path: string;
  blobId: string;
  blobHash: string;
  range?: {
    start: number;
    end: number;
  };
}

export interface SiteResourceData {
  id: string;
  creator: string;
  description: string;
  imageUrl: string;
  link: string;
  name: string;
  projectUrl: string;
  resources: ResourceData[];
  epoch: number;
  blobs: { [blobId: string]: OwnedBlob };
}

export async function getAllObjects(
  client: SuiClient,
  { ids, ...rest }: MultiGetObjectsParams,
): Promise<ResourceData[]> {
  if (ids.length === 0) return [];

  const results: SuiParsedData[] = [];

  for (let i = 0; i < ids.length; i += OBJECTSIZE) {
    const chunk = ids.slice(i, i + OBJECTSIZE);
    const response = await client.multiGetObjects({
      ids: chunk,
      ...rest,
    });
    results.push(...response.map((item) => item.data!.content!));
  }

  return results.map((item) => {
    const content = item as unknown as {
      fields: {
        id: { id: string };
        value: {
          fields: {
            path: string;
            blob_id: string;
            blob_hash: string;
            range?: {
              fields: {
                start: string;
                end: string;
              };
            };
          };
        };
      };
    };

    return {
      id: content.fields.id.id,
      path: content.fields.value.fields.path,
      blobId: bigintToBase64UrlLE(content.fields.value.fields.blob_id),
      blobHash: bigintToHexLE(content.fields.value.fields.blob_hash),
      range: content.fields.value.fields.range
        ? {
            end: parseInt(content.fields.value.fields.range?.fields.end),
            start: parseInt(content.fields.value.fields.range?.fields.start),
          }
        : undefined,
    };
  });
}

export const getSiteResources = async (
  prefix: string,
): Promise<SiteResourceData> => {
  try {
    const config = await loadSiteConfig();
    const network = config?.network || 'testnet';
    const suiClient = new SuiClient({ url: getFullnodeUrl(network) });
    const suinsClient = new SuinsClient({
      client: suiClient,
      network: network,
    });

    let siteId = '';

    if (/^[0-9a-z]{50}$/.test(prefix)) {
      siteId = BigInt(
        `0x${[...prefix]
          .reduce((acc, char) => acc * 36n + BigInt(parseInt(char, 36)), 0n)
          .toString(16)}`,
      ).toString(16);
    } else {
      const nameRecord = await suinsClient.getNameRecord(`${prefix}.sui`);
      if (!nameRecord || !nameRecord.walrusSiteId) {
        throw new Error('Failed to resolve name service address.');
      }
      siteId = nameRecord.walrusSiteId;
    }

    const siteObject = await suiClient.getObject({
      id: siteId,
      options: { showContent: true, showOwner: true },
    });

    if (
      !siteObject ||
      !siteObject.data ||
      siteObject.data.content!.dataType !== 'moveObject' ||
      !siteObject.data.content!.type.endsWith('::site::Site')
    ) {
      throw new Error('Failed to fetch site object.');
    }

    const blobs = await getAllOwnedObjects(
      suiClient,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (siteObject.data.owner as any).AddressOwner!,
    );

    const ids = await getAllDynamicFields(suiClient, siteId);
    const resources = await getAllObjects(suiClient, {
      ids,
      options: { showContent: true },
    });

    resources.sort((a, b) => {
      const priority = (path: string) => {
        if (path === '/.well-known/walrus-sites.intoto.jsonl') return 0;
        if (path === '/.well-known/site.config.json') return 1;
        if (path.startsWith('/.well-known/')) return 2;
        return 3;
      };

      const aPriority = priority(a.path);
      const bPriority = priority(b.path);

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      return a.path.localeCompare(b.path);
    });

    const epoch = await getCurrentWalrusEpoch(suiClient);

    return {
      id: siteId,
      creator: getMoveField(siteObject.data.content!, 'creator'),
      description: getMoveField(siteObject.data.content!, 'description'),
      imageUrl: getMoveField(siteObject.data.content!, 'image_url'),
      link: getMoveField(siteObject.data.content!, 'link'),
      name: getMoveField(siteObject.data.content!, 'name'),
      projectUrl: getMoveField(siteObject.data.content!, 'project_url'),
      resources,
      epoch,
      blobs,
    };
  } catch (error) {
    console.error('Error fetching site object:', error);
    throw new Error('Unable to fetch site object');
  }
};
