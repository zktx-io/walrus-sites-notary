import {
  loadDeploymentTransaction,
  parseDeploymentContextFromBytes,
} from '../verification/mvrDeployment';

import { APP_NETWORK, createGrpcClient, Network } from './suiClient';

export const getPackageCreationTransaction = async (
  packageId: string,
  network: Network = APP_NETWORK,
): Promise<string> => {
  const grpcClient = createGrpcClient(network);

  const response = await grpcClient.getObject({
    objectId: packageId,
    include: {
      previousTransaction: true,
    },
  });

  const txDigest = response.object?.previousTransaction;

  if (!txDigest) {
    throw new Error('Previous transaction not available for this package');
  }

  const loadedTransaction = await loadDeploymentTransaction(network, txDigest);
  try {
    parseDeploymentContextFromBytes(loadedTransaction.rawTransactionBytes);
  } catch {
    throw new Error(
      'Resolved transaction does not create the requested package',
    );
  }

  return txDigest;
};
