import { bcs } from '@mysten/sui/bcs';
import { SuiClient } from '@mysten/sui/client';
import { deriveDynamicFieldID } from '@mysten/sui/utils';

import { isMoveObject } from './getSiteResources';
import { loadSiteConfig } from './loadSiteConfig';

const SystemObjectId = {
  testnet: '0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af',
  mainnet: '0x2134d52768ea07e8c43570ef975eb3e4c27a39fa6396bef985b5abc58d03ddd2',
} as const;

const toNumber = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v !== '' && Number.isFinite(Number(v)))
    return Number(v);
  return undefined;
};

const isRecord = (x: unknown): x is Record<string, unknown> => {
  return typeof x === 'object' && x !== null;
};

const getNested = (obj: unknown, path: string[]): unknown => {
  let cur: unknown = obj;
  for (const key of path) {
    if (!isRecord(cur)) return undefined;

    const direct = (cur as Record<string, unknown>)[key];
    const viaFields = isRecord((cur as Record<string, unknown>).fields)
      ? ((cur as Record<string, unknown>).fields as Record<string, unknown>)[
          key
        ]
      : undefined;

    cur = direct ?? viaFields;
  }
  return cur;
};

export const getCurrentWalrusEpoch = async (
  client: SuiClient,
): Promise<number> => {
  const config = await loadSiteConfig();
  
  const network: keyof typeof SystemObjectId =
    config?.network || 'testnet';
  const objectId = SystemObjectId[network];

  const sys = await client.getObject({
    id: objectId,
    options: { showContent: true },
  });
  const sysContent = sys.data?.content;
  if (!isMoveObject(sysContent))
    throw new Error('Invalid Walrus system object');

  const version = toNumber(getNested(sysContent, ['version']));
  if (version === undefined) throw new Error('staking version not found');

  const dfId = deriveDynamicFieldID(
    objectId,
    'u64',
    bcs.u64().serialize(version).toBytes(),
  );

  const df = await client.getObject({
    id: dfId,
    options: { showContent: true },
  });
  const dfContent = df.data?.content;
  if (!isMoveObject(dfContent))
    throw new Error('Invalid system-state dynamic field');

  const epochVal = getNested(dfContent, ['value', 'committee', 'epoch']);
  const epoch = toNumber(epochVal);
  if (epoch === undefined) throw new Error('epoch not found');

  return epoch;
};
