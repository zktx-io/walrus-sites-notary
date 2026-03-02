import { Transaction } from '@mysten/sui/transactions';
import { normalizeStructTag } from '@mysten/sui/utils';
import { walrus } from '@mysten/walrus';

import { loadSiteConfig } from './loadSiteConfig';
import { createGrpcClient, createGraphQLClient, Network } from './suiClient';

// BLOCKER(extendEpoch/readWalType): getNormalizedMoveStruct was a JSON-RPC-only method.
// Resolved via GraphQL: StakedWal struct fields fetched from GraphQL to extract WAL coin type.
// TODO[Gate-F]: This file uses GraphQL for readWalType. Runtime validation required:
// schema introspection, query smoke check, fallback-path execution.
const readWalType = async (params: {
  network: Network;
  walrusPackageId: string;
}): Promise<string> => {
  const { network, walrusPackageId } = params;
  const gqlClient = createGraphQLClient(network);

  const MOVE_STRUCT_QUERY = `
    query GetStakedWalFields($package: String!, $module: String!, $type: String!) {
      object(address: $package) {
        asMovePackage {
          module(name: $module) {
            struct(name: $type) {
              fields {
                name
                type {
                  repr
                }
              }
            }
          }
        }
      }
    }
  `;

  const r = await gqlClient.query<
    {
      object: {
        asMovePackage: {
          module: {
            struct: {
              fields: { name: string; type: { repr: string } }[];
            };
          };
        };
      } | null;
    },
    { package: string; module: string; type: string }
  >({
    query: MOVE_STRUCT_QUERY,
    variables: {
      package: walrusPackageId,
      module: 'staked_wal',
      type: 'StakedWal',
    },
  });

  // Check errors before data per policy.
  if (r.errors?.length) {
    throw new Error(
      `[readWalType][graphql] errors (network=${network}): ${JSON.stringify(r.errors)}`,
    );
  }

  const fields = r.data?.object?.asMovePackage?.module?.struct?.fields ?? [];
  const principalField = fields.find((f) => f.name === 'principal');
  if (!principalField) {
    throw new Error(
      'WAL type not found: principal field missing from StakedWal',
    );
  }

  // principalField.type.repr is like "0x2::balance::Balance<0x..::wal::WAL>"
  const repr = principalField.type.repr;
  // Extract the inner type argument from Balance<...>
  const match = repr.match(/Balance<(.+)>$/);
  if (!match) {
    throw new Error(
      `WAL type not found: cannot parse Balance<T> from repr: ${repr}`,
    );
  }
  return normalizeStructTag(match[1].trim());
};

export const extendEpoch = async (opts: {
  sender: string;
  objectIds: string[];
  epochs: number;
}): Promise<Transaction> => {
  const config = await loadSiteConfig();
  const network = (config?.network || 'testnet') as Network;

  // Walrus 1.x: use createGrpcClient extended with walrus().
  // Network is caller-provided (from site config), not a hardcoded module-scope literal.
  const walrusClient = createGrpcClient(network).$extend(walrus());
  const baseClient = createGrpcClient(network);

  const walrusSystemObj = await walrusClient.walrus.systemObject();
  const walrusPackageId = walrusSystemObj.package_id;

  const tx = new Transaction();
  const blobs: { objectId: string; cost: bigint }[] = [];
  const epoch = tx.pure('u32', opts.epochs);

  const walType = await readWalType({ network, walrusPackageId });

  // listCoins replaces getCoins in Sui 2.x.
  // Response shape: { objects: Coin[], hasNextPage, cursor }
  const coinsResult = await baseClient.listCoins({
    coinType: walType,
    owner: opts.sender,
  });
  const walCoins = coinsResult.objects ?? [];

  if (walCoins.length === 0) {
    throw new Error(`No WAL coins found for sender ${opts.sender}`);
  }

  const pay = tx.object(walCoins[0].objectId);
  tx.mergeCoins(
    pay,
    walCoins.slice(1).map((c) => tx.object(c.objectId)),
  );

  for (const objectId of opts.objectIds) {
    // getObject in 2.x uses objectId and returns { object: Object<Include> }.
    // Use json: true to get the JSON-parsed dynamic fields.
    const { object } = await baseClient.getObject({
      objectId,
      include: { json: true },
    });

    if (!object || !object.json) {
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const size = (object.json as any).size;

    if (!size) {
      continue;
    }

    const { storageCost } = await walrusClient.walrus.storageCost(
      size,
      opts.epochs,
    );
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
        tx.object(walrusSystemObj.id),
        tx.object(blobs[i].objectId),
        epoch,
        wals[i],
      ],
    });
  }

  tx.transferObjects([...wals], opts.sender);
  tx.setSender(opts.sender);

  // simulateTransaction replaces dryRunTransactionBlock in 2.x.
  // SimulateTransactionResult shape: { $kind, Transaction/FailedTransaction, commandResults }
  const sim = await baseClient.simulateTransaction({
    transaction: await tx.build({ client: baseClient }),
  });

  // GasCostSummary fields: computationCost, storageCost, storageRebate, nonRefundableStorageFee
  const txData =
    sim.$kind === 'Transaction' ? sim.Transaction : sim.FailedTransaction;
  // effects must be included explicitly; however simulateTransaction by default includes effects.
  // Access gasUsed from effects if available.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gasUsed = (txData as any)?.effects?.gasUsed ?? (sim as any).gasUsed;
  const gasBudget = gasUsed?.computationCost
    ? Number(gasUsed.computationCost) * 2
    : 10_000_000;

  tx.setGasBudget(gasBudget);

  return tx;
};
