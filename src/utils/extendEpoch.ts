import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { normalizeStructTag } from '@mysten/sui/utils';
import { WalrusClient } from '@mysten/walrus';

import { loadSiteConfig } from './loadSiteConfig';

const structToString = (s: {
  address: string;
  module: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  typeArguments?: any[];
}): string => {
  const base = `${s.address}::${s.module}::${s.name}`;
  const args = s.typeArguments ?? [];
  if (args.length === 0) return base;
  return `${base}<${args.map(normalizedTypeToString).join(',')}>`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizedTypeToString = (t: any): string => {
  if (typeof t === 'string') return t.toLowerCase();
  if ('Struct' in t) return structToString(t.Struct);
  if ('Vector' in t) return `vector<${normalizedTypeToString(t.Vector)}>`;
  if ('Reference' in t) return `&${normalizedTypeToString(t.Reference)}`;
  if ('MutableReference' in t)
    return `&mut ${normalizedTypeToString(t.MutableReference)}`;
  if ('TypeParameter' in t) return `T${t.TypeParameter}`;
  throw new Error('Unsupported normalized type shape');
};

const readWalType = async (params: {
  suiClient: SuiClient;
  walrusPackageId: string; // (await walrusClient.systemObject()).package_id
}): Promise<string> => {
  const { suiClient, walrusPackageId } = params;

  const stakedWal = await suiClient.jsonRpc.getNormalizedMoveStruct({
    package: walrusPackageId,
    module: 'staked_wal',
    struct: 'StakedWal',
  });

  const principal = stakedWal.fields.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (f: any) => f.name === 'principal',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as { name: string; type: any } | undefined;

  if (!principal?.type || !('Struct' in principal.type)) {
    throw new Error('WAL type not found: invalid principal type');
  }

  // principal.type is Balance<T>; grab the first type argument (T)
  const balance = principal.type.Struct; // 0x2::balance::Balance<...>
  const coinArg = balance.typeArguments?.[0];
  if (!coinArg || !('Struct' in coinArg)) {
    throw new Error('WAL type not found: Balance<T> has no struct type arg');
  }

  const walTypeStr = structToString(coinArg.Struct);
  return normalizeStructTag(walTypeStr);
};

export const extendEpoch = async (opts: {
  sender: string;
  objectIds: string[];
  epochs: number;
}): Promise<Transaction> => {
  const config = await loadSiteConfig();
  const network = config?.network || 'testnet';
  const suiClient = new SuiClient({ url: getFullnodeUrl(network) });
  const walrusClient = new WalrusClient({ network, suiClient });
  const walrusSystemObj = await walrusClient.systemObject();
  const walrusPackageId = walrusSystemObj.package_id;

  const tx = new Transaction();
  const blobs: { objectId: string; cost: bigint }[] = [];
  const epoch = tx.pure('u32', opts.epochs);

  const walType = await readWalType({ suiClient, walrusPackageId });
  const { data: walCoins } = await suiClient.getCoins({
    coinType: walType,
    owner: opts.sender,
  });

  const pay = tx.object(walCoins[0].coinObjectId);
  tx.mergeCoins(
    pay,
    walCoins.slice(1).map((c) => tx.object(c.coinObjectId)),
  );

  for (const objectId of opts.objectIds) {
    const { data } = await suiClient.getObject({
      id: objectId,
      options: { showContent: true },
    });
    if (!data || data.content?.dataType !== 'moveObject') {
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const size = (data.content.fields as any).size;

    if (!size) {
      continue;
    }

    const { storageCost } = await walrusClient.storageCost(size, opts.epochs);
    blobs.push({ objectId, cost: storageCost });
  }

  const [...wals] = tx.splitCoins(
    pay,
    blobs.map((b) => b.cost),
  );

  for (let i = 0; i < blobs.length; i++) {
    tx.moveCall({
      target: `${walrusPackageId}::system::extend_blob`,
      arguments: [
        tx.object(walrusSystemObj.id.id),
        tx.object(blobs[i].objectId),
        epoch,
        wals[i],
      ],
    });
  }

  tx.transferObjects([...wals], opts.sender);
  tx.setSender(opts.sender);
  const { input } = await suiClient.dryRunTransactionBlock({
    transactionBlock: await tx.build({ client: suiClient }),
  });

  if (!input) {
    throw new Error('Failed to dry run transaction');
  }

  tx.setGasBudget(Number(input.gasData.budget));

  return tx;
};
