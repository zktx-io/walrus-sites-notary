import type { DeploymentContext } from './mvrDeploymentParser';
import { isSameSuiObjectId } from './mvrObjectId';
import {
  hasCreatedImmutableAddress,
  type LoadedDeploymentTransaction,
} from './mvrTransactionLoader';

export const deploymentTargetsPackage = (
  deployment: DeploymentContext,
  loadedTransaction: Pick<
    LoadedDeploymentTransaction,
    'createdImmutableAddresses'
  >,
  packageAddress: string,
): boolean => {
  if (deployment.kind === 'upgrade') {
    return Boolean(
      deployment.upgradePackageId &&
        isSameSuiObjectId(deployment.upgradePackageId, packageAddress),
    );
  }

  return hasCreatedImmutableAddress(loadedTransaction, packageAddress);
};
