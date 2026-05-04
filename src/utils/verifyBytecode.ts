import {
  hasCreatedImmutableAddress,
  loadDeploymentTransaction,
  parseDeploymentContextFromBytes,
  type DeploymentContext,
  verifyDeploymentProvenanceHash,
} from '../verification/mvrDeployment';

import { JsonLPayload } from './parseJsonl';

export const verifyBytecode = async (
  packageAddress: string,
  digest: string,
  provenance: JsonLPayload,
): Promise<boolean> => {
  const loadedTransaction = await loadDeploymentTransaction('mainnet', digest);

  if (loadedTransaction.createdImmutableAddresses.length === 0) {
    return false;
  }

  if (!hasCreatedImmutableAddress(loadedTransaction, packageAddress)) {
    return false;
  }

  let deployment: DeploymentContext;
  try {
    deployment = parseDeploymentContextFromBytes(
      loadedTransaction.rawTransactionBytes,
    );
  } catch {
    return false;
  }

  return verifyDeploymentProvenanceHash(deployment, provenance);
};
