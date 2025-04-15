import {
  DynamicFieldInfo,
  getFullnodeUrl,
  MoveValue,
  MultiGetObjectsParams,
  SuiClient,
  SuiParsedData,
} from '@mysten/sui/client';
import { toBase64 } from '@mysten/sui/utils';
import { SuinsClient } from '@mysten/suins';

const OBJECTSIZE = 50;

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

const getMoveField = (
  content: SuiParsedData | undefined,
  key: string,
): string => {
  if (content && content.dataType === 'moveObject' && content.fields !== null) {
    return (content.fields as Record<string, MoveValue>)[key] as string;
  }
  return '';
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
          };
        };
      };
    };

    return {
      id: content.fields.id.id,
      path: content.fields.value.fields.path,
      blobId: bigintToBase64UrlLE(content.fields.value.fields.blob_id),
      blobHash: content.fields.value.fields.blob_hash,
    };
  });
}

export const NETWORK = 'mainnet';

export const getSiteResources = async (
  prefix: string,
): Promise<SiteResourceData> => {
  try {
    const suiClient = new SuiClient({ url: getFullnodeUrl(NETWORK) });
    const suinsClient = new SuinsClient({
      client: suiClient,
      network: NETWORK,
    });

    const nameRecord = await suinsClient.getNameRecord(`${prefix}.sui`);

    if (!nameRecord || !nameRecord.walrusSiteId) {
      throw new Error('Failed to resolve name service address.');
    }

    const siteObject = await suiClient.getObject({
      id: nameRecord.walrusSiteId,
      options: { showContent: true },
    });

    if (
      !siteObject ||
      !siteObject.data ||
      siteObject.data.content!.dataType !== 'moveObject' ||
      !siteObject.data.content!.type.endsWith('::site::Site')
    ) {
      throw new Error('Failed to fetch site object.');
    }

    const ids = await getAllDynamicFields(suiClient, nameRecord.walrusSiteId);
    const resources = await getAllObjects(suiClient, {
      ids,
      options: { showContent: true },
    });

    return {
      id: nameRecord.walrusSiteId,
      creator: getMoveField(siteObject.data.content!, 'creator'),
      description: getMoveField(siteObject.data.content!, 'description'),
      imageUrl: getMoveField(siteObject.data.content!, 'image_url'),
      link: getMoveField(siteObject.data.content!, 'link'),
      name: getMoveField(siteObject.data.content!, 'name'),
      projectUrl: getMoveField(siteObject.data.content!, 'project_url'),
      resources,
    };
  } catch (error) {
    console.error('Error fetching site object:', error);
    throw new Error('Unable to fetch site object');
  }
};
