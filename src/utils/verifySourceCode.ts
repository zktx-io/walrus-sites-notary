import {
  verifyMvrSourceBuild,
  type VerificationResult,
} from '../verification/mvrSourceBuild';

import type { Network } from './suiClient';

export type { VerificationResult };

/**
 * Verify that deployed bytecode matches the source code from GitHub.
 *
 * Kept as a compatibility wrapper for the existing UI call sites while the
 * implementation lives in the MVR verification domain.
 */
export const verifySourceCode = async (
  repoUrl: string,
  tag: string,
  path: string,
  packageAddress: string,
  txDigest: string,
  network: Network,
  log?: (message: string) => void,
  githubToken?: string,
): Promise<VerificationResult> =>
  verifyMvrSourceBuild({
    repoUrl,
    tag,
    path,
    packageAddress,
    txDigest,
    network,
    log,
    githubToken,
  });
