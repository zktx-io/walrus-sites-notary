import { SuiGrpcClient } from '@mysten/sui/grpc';
import { toBase64 } from '@mysten/sui/utils';
import { suins } from '@mysten/suins';

import { getCurrentWalrusEpoch } from './getCurrentWalrusEpoch';
import { loadSiteConfig } from './loadSiteConfig';
import { createGrpcClient, Network } from './suiClient';

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

const hexChars = '0123456789abcdef';
const bigintToHexLE = (num: string): string => {
  const bytes = new Uint8Array(32);

  let temp = BigInt(num);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number(temp & 0xffn);
    temp >>= 8n;
  }

  let hex = '';
  for (const b of bytes) {
    hex += hexChars[b >> 4] + hexChars[b & 0xf];
  }
  return hex;
};

type BlobStorageJson = {
  start_epoch?: number | string;
  end_epoch?: number | string;
  storage_size?: string | number;
};

type BlobJson = {
  blob_id?: string | number;
  deletable?: boolean;
  storage?: BlobStorageJson | { fields?: BlobStorageJson };
};

const toNum = (v?: number | string): number | undefined =>
  typeof v === 'number'
    ? v
    : typeof v === 'string' && v !== ''
      ? Number(v)
      : undefined;

const toStr = (v?: number | string): string | undefined =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined;

// List all owned Blob objects using listOwnedObjects (replaces getOwnedObjects in 2.x).
// Response shape: { objects: Object[], hasNextPage, cursor }
// Network is caller-provided.
const getAllOwnedObjects = async (
  client: SuiGrpcClient,
  owner: string,
): Promise<{ [blobId: string]: OwnedBlob }> => {
  const out: { [blobId: string]: OwnedBlob } = {};
  let cursor: string | null | undefined = undefined;

  for (; ;) {
    const resp: {
      objects: {
        objectId: string;
        type: string;
        json: Record<string, unknown> | null | undefined;
        owner: {
          $kind: string;
          AddressOwner?: string;
          ConsensusAddressOwner?: { owner: string };
        };
      }[];
      hasNextPage: boolean;
      cursor: string | null;
    } = await client.listOwnedObjects({
      owner,
      cursor,
      limit: 50,
      include: { json: true },
    });

    for (const obj of resp.objects) {
      if (
        !obj.type?.endsWith('::blob::Blob') &&
        !obj.type?.endsWith('::blobs::Blob')
      )
        continue;

      const json = obj.json as BlobJson | undefined | null;
      if (!json) continue;

      const rawBlobId = toStr(json.blob_id as string | number | undefined);
      if (!rawBlobId) continue;

      // storage can be nested in different ways depending on JSON-RPC vs gRPC representation.

      const s: BlobStorageJson | undefined =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (json.storage as any)?.fields ??
        (json.storage as BlobStorageJson | undefined);

      const blobId = bigintToBase64UrlLE(rawBlobId);
      out[blobId] = {
        objectId: obj.objectId,
        deletable: Boolean(json.deletable),
        startEpoch: toNum(s?.start_epoch),
        endEpoch: toNum(s?.end_epoch),
        storageSize: toStr(s?.storage_size),
      };
    }

    if (!resp.hasNextPage || !resp.cursor) break;
    cursor = resp.cursor;
  }

  return out;
};

// List all dynamic fields (paginated) using listDynamicFields.
// Response shape: { dynamicFields: DynamicFieldEntry[], hasNextPage, cursor }
const getAllDynamicFields = async (
  client: SuiGrpcClient,
  parentId: string,
): Promise<string[]> => {
  const resourceObjectIds: string[] = [];
  let cursor: string | null | undefined = undefined;

  while (true) {
    const page = await client.listDynamicFields({
      parentId,
      cursor,
      limit: 50,
    });

    for (const field of page.dynamicFields) {
      // DynamicObject fields have childId (the actual child object's ID).
      // DynamicField fields have fieldId (the field storage object).
      // Resource entries are DynamicObject with type ending in ::site::Resource.
      if (field.valueType.endsWith('::site::Resource')) {
        const id =
          field.$kind === 'DynamicObject' ? field.childId : field.fieldId;
        resourceObjectIds.push(id);
      }
    }

    if (!page.hasNextPage || !page.cursor) break;
    cursor = page.cursor;
  }

  return resourceObjectIds;
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
  siteObjOwner: string;
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
  client: SuiGrpcClient,
  ids: string[],
): Promise<ResourceData[]> {
  if (ids.length === 0) return [];

  const results: Record<string, unknown>[] = [];

  for (let i = 0; i < ids.length; i += OBJECTSIZE) {
    const chunk = ids.slice(i, i + OBJECTSIZE);
    // getObjects in 2.x uses { objectIds, include? } and returns { objects: (Object|Error)[] }
    const response = await client.getObjects({
      objectIds: chunk,
      include: { json: true },
    });
    for (const item of response.objects) {
      // item is Object<Include> or Error - Error has an 'error' field
      if ('objectId' in item && item.json) {
        results.push(item.json as Record<string, unknown>);
      }
    }
  }

  return results.map((json) => {
    // gRPC 2.x returns flat JSON (no .fields wrapper).
    // Old JSON-RPC shape: { id: { id }, value: { fields: { path, blob_id, ... } } }
    // New gRPC shape:     { id: string,  value: { path, blob_id, range: { start, end } } }
    const content = json as {
      id: string;
      value: {
        path: string;
        blob_id: string;
        blob_hash: string;
        range?: { start: string; end: string };
      };
    };

    return {
      id: content.id ?? '',
      path: content.value?.path ?? '',
      blobId: bigintToBase64UrlLE(content.value?.blob_id ?? '0'),
      blobHash: bigintToHexLE(content.value?.blob_hash ?? '0'),
      range: content.value?.range
        ? {
          start: parseInt(content.value.range.start),
          end: parseInt(content.value.range.end),
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
    const network = (config?.network || 'testnet') as Network;

    // Network is caller-provided via site config (not a hardcoded module-scope literal).
    const grpcClient = createGrpcClient(network);

    // SuiNS 1.x: use SuiGrpcClient extended with suins().
    const suinsClient = createGrpcClient(network).$extend(suins());

    let siteId = '';

    if (/^[0-9a-z]{50}$/.test(prefix)) {
      siteId = BigInt(
        `0x${[...prefix]
          .reduce((acc, char) => acc * 36n + BigInt(parseInt(char, 36)), 0n)
          .toString(16)}`,
      ).toString(16);
    } else {
      const nameRecord = await suinsClient.suins.getNameRecord(`${prefix}.sui`);
      if (!nameRecord || !nameRecord.walrusSiteId) {
        throw new Error('Failed to resolve name service address.');
      }
      siteId = nameRecord.walrusSiteId;
    }

    // getObject in 2.x uses { objectId } and returns { object: Object<Include> }
    const siteObjectResp = await grpcClient.getObject({
      objectId: siteId,
      include: { json: true },
    });
    const siteObj = siteObjectResp.object;

    if (!siteObj || !siteObj.type?.endsWith('::site::Site')) {
      throw new Error('Failed to fetch site object.');
    }

    const siteJson = siteObj.json as Record<string, unknown> | null;

    // Owner is a discriminated union: { $kind: 'AddressOwner', AddressOwner: string } etc.
    const ownerVal = siteObj.owner;
    const siteObjOwner =
      ownerVal?.$kind === 'AddressOwner'
        ? ownerVal.AddressOwner
        : ownerVal?.$kind === 'ConsensusAddressOwner'
          ? ownerVal.ConsensusAddressOwner.owner
          : '';

    const blobs = await getAllOwnedObjects(grpcClient, siteObjOwner);
    const ids = await getAllDynamicFields(grpcClient, siteId);
    const resources = await getAllObjects(grpcClient, ids);

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

    const epoch = await getCurrentWalrusEpoch(network);

    const getField = (key: string): string =>
      typeof siteJson?.[key] === 'string' ? (siteJson[key] as string) : '';

    return {
      id: siteId,
      siteObjOwner,
      creator: getField('creator'),
      description: getField('description'),
      imageUrl: getField('image_url'),
      link: getField('link'),
      name: getField('name'),
      projectUrl: getField('project_url'),
      resources,
      epoch,
      blobs,
    };
  } catch (error) {
    console.error('Error fetching site object:', error);
    throw new Error('Unable to fetch site object');
  }
};
