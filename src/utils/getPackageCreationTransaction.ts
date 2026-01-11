import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';

export const getPackageCreationTransaction = async (
  packageId: string,
  network: 'mainnet' | 'testnet' | 'devnet' = 'mainnet',
): Promise<string> => {
  const client = new SuiClient({
    url: getFullnodeUrl(network),
  });

  const response = await client.getObject({
    id: packageId,
    options: {
      showPreviousTransaction: true,
      showContent: false,
    },
  });

  const txDigest = response.data?.previousTransaction;

  if (!txDigest) {
    throw new Error('Previous transaction not available for this package');
  }

  const txBlock = await client.getTransactionBlock({
    digest: txDigest,
    options: {
      showEffects: true,
    },
  });

  const createdPackage = txBlock.effects?.created?.some(
    (created) => created.reference.objectId === packageId,
  );

  if (!createdPackage) {
    throw new Error(
      'Resolved transaction does not create the requested package',
    );
  }

  return txDigest;
};
