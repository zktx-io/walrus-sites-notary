import {
  deploymentTargetsPackage,
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

  let deployment: DeploymentContext;
  try {
    deployment = parseDeploymentContextFromBytes(
      loadedTransaction.rawTransactionBytes,
    );
  } catch {
    return false;
  }

  if (
    deployment.kind === 'publish' &&
    loadedTransaction.createdImmutableAddresses.length === 0
  ) {
    return false;
  }

  if (!deploymentTargetsPackage(deployment, loadedTransaction, packageAddress)) {
    return false;
  }

  return verifyDeploymentProvenanceHash(deployment, provenance);
};
