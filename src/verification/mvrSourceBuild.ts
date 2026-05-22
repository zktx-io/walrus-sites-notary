import { normalizeSuiObjectId } from '@mysten/sui/utils';
import { bytesToHex } from '@noble/hashes/utils.js';
import { fetchMovePackageFromGitHub } from '@zktx.io/sui-move-builder';
import {
  verifyMovePackageProvenance,
  type MovePackageProvenanceInput,
  type MovePackageProvenanceResult,
  type VerificationFailureStage,
  type VerificationStatus,
  type VerificationVerdict,
} from '@zktx.io/sui-move-builder/verification';

import {
  extractSourceFailureHints,
  type SourceFailureContext,
} from '../utils/sourceFailureHints';
import { Network } from '../utils/suiClient';

import {
  deploymentTargetsPackage,
  DeploymentContext,
  DeploymentKind,
  LoadedDeploymentTransaction,
  loadDeploymentTransaction,
  parseDeploymentContextFromBytes,
} from './mvrDeployment';

type MovePackageProgressEvent = Parameters<
  NonNullable<MovePackageProvenanceInput['onProgress']>
>[0];

type FetchedMovePackageSource =
  | Record<string, string>
  | Pick<MovePackageProvenanceInput, 'files' | 'rootGit'>;

export interface VerificationResult {
  success: boolean;
  message: string;
  details?: {
    builtModules?: string[];
    deployedModules?: string[];
    builtDependencies?: string[];
    deployedDependencies?: string[];
    builtDigest?: string;
    matchingModules?: number;
    totalModules?: number;
    matchingDependencies?: number;
    totalDependencies?: number;
    deploymentKind?: DeploymentKind;
    buildIntent?: DeploymentKind;
    upgradePackageId?: string;
    verificationStatus?: VerificationStatus;
    verificationVerdict?: VerificationVerdict;
    verificationSummary?: string;
    verificationDisplayMessage?: string;
    failureStage?: VerificationFailureStage;
    selectedVerifier?: MovePackageProvenanceResult['selectedVerifier'];
    candidatesConsidered?: MovePackageProvenanceResult['candidatesConsidered'];
    referenceBytecode?: MovePackageProvenanceResult['referenceBytecode'];
    sourceCompatibility?: MovePackageProvenanceResult['sourceCompatibility'];
    referenceSummary?: MovePackageProvenanceResult['referenceSummary'];
    currentSummary?: MovePackageProvenanceResult['currentSummary'];
    differences?: string[];
    bytecodeDiffs?: MovePackageProvenanceResult['bytecodeDiffs'];
    bytecodeHeaderEvidence?: MovePackageProvenanceResult['bytecodeHeaderEvidence'];
  };
  error?: string;
}

export interface VerifyMvrSourceBuildInput {
  repoUrl: string;
  tag: string;
  path: string;
  packageAddress: string;
  txDigest: string;
  network: Network;
  githubToken?: string;
  log?: (message: string) => void;
}

export interface VerifyMvrSourceBuildAdapters {
  fetchSource?: (
    url: string,
    options?: { githubToken?: string },
  ) => Promise<FetchedMovePackageSource>;
  verifyProvenance?: (
    input: MovePackageProvenanceInput,
  ) => Promise<MovePackageProvenanceResult>;
  loadTransaction?: (
    network: Network,
    txDigest: string,
  ) => Promise<LoadedDeploymentTransaction>;
  parseDeployment?: (rawTransactionBytes: Uint8Array) => DeploymentContext;
}

export interface BytecodeComparisonDetails {
  builtModules: string[];
  deployedModules: string[];
  builtDependencies: string[];
  deployedDependencies: string[];
  builtDigest?: string;
  matchingModules: number;
  totalModules: number;
  matchingDependencies: number;
  totalDependencies: number;
}

interface BytecodeComparison {
  success: boolean;
  message: string;
  details: BytecodeComparisonDetails;
}

type FetchFailedProgressEvent = Extract<
  MovePackageProgressEvent,
  { type: 'fetch_failed' }
>;

const verifierAssetBaseUrl = (): string | undefined =>
  typeof window === 'undefined' ? undefined : '/assets';

const describeProgressSource = (
  source?: FetchFailedProgressEvent['source'],
): string => {
  if (!source || typeof source !== 'object') return '<unknown>';
  const value = source as {
    type?: string;
    git?: string;
    rev?: string;
    subdir?: string;
    local?: string;
    address?: string;
  };

  if (value.type === 'git') {
    return `${value.git ?? '<unknown>'}@${value.rev ?? '<unknown>'}${
      value.subdir ? `/${value.subdir}` : ''
    }`;
  }

  if (value.type === 'local') {
    return `local:${value.local ?? '<unknown>'}`;
  }

  return value.address ?? value.type ?? '<unknown>';
};

const logProgressEvent = (
  event: MovePackageProgressEvent,
  log?: (message: string) => void,
) => {
  if (!log) return;

  switch (event.type) {
    case 'resolve_start':
      log('🔍 Resolving dependencies...');
      break;
    case 'resolve_dep':
      log(
        `🔗 Resolving dep [${event.current}/${event.total}]: ${event.name} (${event.source})`,
      );
      break;
    case 'resolve_complete':
      log(`✅ Dependency resolution complete (${event.count} dependencies)`);
      break;
    case 'compile_start':
      log('🛠️  Compiling Move package...');
      break;
    case 'compile_complete':
      log('✅ Compilation complete');
      break;
    case 'lockfile_generate':
      log('🔒 Generating Move.lock file...');
      break;
    case 'fetch_failed':
      log(
        `❌ Source fetch failed: ${event.dependencyName} (${describeProgressSource(event.source)})`,
      );
      if (event.parentPackageName) {
        log(`• Parent package: ${event.parentPackageName}`);
      }
      if (event.code) {
        log(`• Failure code: ${event.code}`);
      }
      log(`• ${event.error}`);
      break;
    default:
      log(`[progress] ${JSON.stringify(event)}`);
  }
};

const normalizeFetchedSource = (
  source: FetchedMovePackageSource,
): Pick<MovePackageProvenanceInput, 'files' | 'rootGit'> => {
  const maybePackage = source as Partial<
    Pick<MovePackageProvenanceInput, 'files' | 'rootGit'>
  >;

  if (
    maybePackage.files &&
    typeof maybePackage.files === 'object' &&
    !Array.isArray(maybePackage.files)
  ) {
    return {
      files: maybePackage.files,
      rootGit: maybePackage.rootGit,
    };
  }

  return { files: source as Record<string, string> };
};

const logSourceFailureHints = (
  error: string,
  log?: (message: string) => void,
  fallback?: SourceFailureContext,
) => {
  for (const hint of extractSourceFailureHints(error, fallback)) {
    log?.(`❌ Source access failed: ${hint}`);
  }
};

export const compareMoveBytecode = ({
  builtModules,
  deployedModules,
  builtDependencies,
  deployedDependencies,
  builtDigest,
}: {
  builtModules: string[];
  deployedModules: string[];
  builtDependencies: string[];
  deployedDependencies: string[];
  builtDigest?: string;
}): BytecodeComparison => {
  const normalizedBuiltDependencies = builtDependencies.map((dependency) =>
    normalizeSuiObjectId(dependency),
  );
  const normalizedDeployedDependencies = deployedDependencies.map(
    (dependency) => normalizeSuiObjectId(dependency),
  );

  if (builtModules.length !== deployedModules.length) {
    return {
      success: false,
      message: `Module count mismatch: built ${builtModules.length}, deployed ${deployedModules.length}`,
      details: {
        builtModules,
        deployedModules,
        builtDependencies: normalizedBuiltDependencies,
        deployedDependencies: normalizedDeployedDependencies,
        builtDigest,
        matchingModules: 0,
        totalModules: deployedModules.length,
        matchingDependencies: 0,
        totalDependencies: normalizedDeployedDependencies.length,
      },
    };
  }

  let matchingModules = 0;
  for (let index = 0; index < builtModules.length; index++) {
    if (builtModules[index] === deployedModules[index]) {
      matchingModules++;
    }
  }

  if (normalizedBuiltDependencies.length !== normalizedDeployedDependencies.length) {
    return {
      success: false,
      message: `Dependency count mismatch: built ${normalizedBuiltDependencies.length}, deployed ${normalizedDeployedDependencies.length}`,
      details: {
        builtModules,
        deployedModules,
        builtDependencies: normalizedBuiltDependencies,
        deployedDependencies: normalizedDeployedDependencies,
        builtDigest,
        matchingModules,
        totalModules: builtModules.length,
        matchingDependencies: 0,
        totalDependencies: normalizedDeployedDependencies.length,
      },
    };
  }

  let matchingDependencies = 0;
  for (
    let index = 0;
    index < normalizedBuiltDependencies.length;
    index++
  ) {
    if (
      normalizedBuiltDependencies[index] ===
      normalizedDeployedDependencies[index]
    ) {
      matchingDependencies++;
    }
  }

  const modulesMatch = matchingModules === builtModules.length;
  const dependenciesMatch =
    matchingDependencies === normalizedBuiltDependencies.length;
  const success = modulesMatch && dependenciesMatch;

  return {
    success,
    message: success
      ? 'Source code verification successful! Modules and dependencies match.'
      : `Partial match: modules ${matchingModules}/${builtModules.length}, dependencies ${matchingDependencies}/${normalizedBuiltDependencies.length} match`,
    details: {
      builtModules,
      deployedModules,
      builtDependencies: normalizedBuiltDependencies,
      deployedDependencies: normalizedDeployedDependencies,
      builtDigest,
      matchingModules,
      totalModules: builtModules.length,
      matchingDependencies,
      totalDependencies: normalizedBuiltDependencies.length,
    },
  };
};

const deploymentPackageFailure = (
  packageAddress: string,
  loadedTransaction: LoadedDeploymentTransaction,
  deployment: DeploymentContext,
): VerificationResult | null => {
  if (
    deployment.kind === 'publish' &&
    loadedTransaction.createdImmutableAddresses.length === 0
  ) {
    return {
      success: false,
      message: 'Transaction not found or has no created immutable objects',
      error: 'Invalid transaction',
    };
  }

  if (!deploymentTargetsPackage(deployment, loadedTransaction, packageAddress)) {
    return {
      success: false,
      message: 'Package address does not match',
      error: 'Address mismatch',
    };
  }

  return null;
};

const buildDetails = (
  comparison: BytecodeComparisonDetails,
  deployment: DeploymentContext,
): VerificationResult['details'] => ({
  ...comparison,
  deploymentKind: deployment.kind,
  buildIntent: deployment.kind,
  upgradePackageId: deployment.upgradePackageId,
});

const digestToHex = (digest?: number[] | string): string | undefined => {
  if (!digest) return undefined;
  if (typeof digest === 'string') return digest;
  return bytesToHex(new Uint8Array(digest));
};

const createReferenceArtifact = (
  deployment: DeploymentContext,
  packageAddress: string,
): MovePackageProvenanceInput['reference'] => {
  const reference: MovePackageProvenanceInput['reference'] = {
    modules: deployment.modules,
    dependencies: deployment.dependencies,
  };

  if (deployment.kind === 'publish') {
    reference.packageId = packageAddress;
  }

  return reference;
};

const verificationStatusMessage = (
  result: MovePackageProvenanceResult,
): string => {
  switch (result.status) {
    case 'verified':
      return 'Source code verification successful! Modules and dependencies match.';
    case 'mismatch':
      return 'Source verification mismatch: rebuilt bytecode does not match deployed bytecode.';
    case 'bytecode_version_mismatch':
      return 'Bytecode version mismatch: this verifier cannot prove byte-for-byte provenance for the reference bytecode version.';
    case 'invalid_reference':
      return 'Invalid reference artifact';
    case 'build_failure':
      return 'Failed to build Move package';
    default:
      return 'Verification failed with error';
  }
};

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

const firstDiagnosticLine = (value?: string): string | undefined => {
  const line = value
    ?.replace(ANSI_REGEX, '')
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find(Boolean);

  if (!line) return undefined;
  return line.length > 240 ? `${line.slice(0, 237)}...` : line;
};

const verificationFailureLogMessage = (
  result: MovePackageProvenanceResult,
): string => {
  const parts = [`status=${result.status}`];
  if (result.failureStage) parts.push(`stage=${result.failureStage}`);
  if (result.verdict) parts.push(`verdict=${result.verdict}`);
  return `❌ Verification failed (${parts.join(', ')})`;
};

const verificationDetails = (
  result: MovePackageProvenanceResult,
  deployment: DeploymentContext,
): VerificationResult['details'] => {
  const provenanceDetails = {
    verificationStatus: result.status,
    verificationVerdict: result.verdict,
    verificationSummary: result.summary,
    verificationDisplayMessage: result.displayMessage,
    failureStage: result.failureStage,
    selectedVerifier: result.selectedVerifier,
    candidatesConsidered: result.candidatesConsidered,
    referenceBytecode: result.referenceBytecode,
    sourceCompatibility: result.sourceCompatibility,
    referenceSummary: result.referenceSummary,
    currentSummary: result.currentSummary,
    differences: result.differences,
    bytecodeDiffs: result.bytecodeDiffs,
    bytecodeHeaderEvidence: result.bytecodeHeaderEvidence,
  };

  if (!result.currentBuild) {
    return {
      deploymentKind: deployment.kind,
      buildIntent: deployment.kind,
      upgradePackageId: deployment.upgradePackageId,
      ...provenanceDetails,
    };
  }

  const comparison = compareMoveBytecode({
    builtModules: result.currentBuild.modules,
    deployedModules: deployment.modules,
    builtDependencies: result.currentBuild.dependencies,
    deployedDependencies: deployment.dependencies,
    builtDigest: digestToHex(result.currentBuild.digest),
  });

  return {
    ...buildDetails(comparison.details, deployment),
    ...provenanceDetails,
  };
};

export const verifyMvrSourceBuild = async (
  input: VerifyMvrSourceBuildInput,
  adapters: VerifyMvrSourceBuildAdapters = {},
): Promise<VerificationResult> => {
  const {
    repoUrl,
    tag,
    path,
    packageAddress,
    txDigest,
    network,
    log,
    githubToken,
  } = input;

  try {
    if (!githubToken) {
      log?.(
        'ℹ️ No GitHub token provided; falling back to anonymous GitHub API limits',
      );
    }

    const sourceContext = { repoUrl, tag, path };
    const fetchSource = adapters.fetchSource ?? fetchMovePackageFromGitHub;
    let source: Pick<MovePackageProvenanceInput, 'files' | 'rootGit'>;
    try {
      source = normalizeFetchedSource(
        await fetchSource(`${repoUrl}/tree/${tag}/${path}`, {
          githubToken,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log?.('❌ Failed to load source snapshot');
      logSourceFailureHints(message, log, sourceContext);
      throw error;
    }

    const { files, rootGit } = source;

    log?.(
      `✓ Source snapshot loaded (${Object.keys(files).length} package files)`,
    );

    log?.('🔗 Fetching deployed bytecode from Sui blockchain...');
    const loadedTransaction = await (
      adapters.loadTransaction ?? loadDeploymentTransaction
    )(network, txDigest);
    log?.('✓ Transaction data retrieved');

    let deployment: DeploymentContext;
    try {
      deployment = (
        adapters.parseDeployment ?? parseDeploymentContextFromBytes
      )(loadedTransaction.rawTransactionBytes);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No Publish or Upgrade command found in transaction';
      log?.(`❌ ${message}`);
      return {
        success: false,
        message,
        error: message.includes('Ambiguous')
          ? 'Ambiguous transaction type'
          : 'Invalid transaction type',
      };
    }

    log?.(
      `✓ Found ${deployment.kind === 'publish' ? 'Publish' : 'Upgrade'} command with ${deployment.dependencies.length} dependencies`,
    );
    log?.(
      `✓ Found ${deployment.kind === 'publish' ? 'Publish' : 'Upgrade'} command with ${deployment.modules.length} modules`,
    );

    const packageFailure = deploymentPackageFailure(
      packageAddress,
      loadedTransaction,
      deployment,
    );
    if (packageFailure) return packageFailure;

    log?.(
      `🔨 Rebuilding Move package for ${deployment.kind} provenance verification...`,
    );
    log?.(
      '⚙️  Selecting Move verifier from reference bytecode version...',
    );
    const browserVerifierAssetBaseUrl = verifierAssetBaseUrl();
    const verificationResult = await (
      adapters.verifyProvenance ?? verifyMovePackageProvenance
    )(
      {
        files,
        rootGit,
        intent: deployment.kind,
        reference: createReferenceArtifact(deployment, packageAddress),
        ...(browserVerifierAssetBaseUrl
          ? { verifierAssetBaseUrl: browserVerifierAssetBaseUrl }
          : {}),
        ansiColor: true,
        network,
        githubToken,
        onProgress: (event) => logProgressEvent(event, log),
      },
    );

    const details = verificationDetails(verificationResult, deployment);
    const message = verificationStatusMessage(verificationResult);

    if (verificationResult.status !== 'verified') {
      log?.(verificationFailureLogMessage(verificationResult));
      const diagnostic = firstDiagnosticLine(
        verificationResult.error ??
          verificationResult.displayMessage ??
          verificationResult.summary,
      );
      if (diagnostic) {
        log?.(`• ${diagnostic}`);
      }
      if (verificationResult.error) {
        logSourceFailureHints(verificationResult.error, log);
      }
      return {
        success: false,
        message,
        error: verificationResult.error,
        details,
      };
    }

    const builtDigest = details?.builtDigest;
    log?.(`✓ Build successful (${details?.builtModules?.length ?? 0} modules)`);
    if (builtDigest) {
      log?.(`📦 Build digest: ${builtDigest.substring(0, 16)}...`);
    }

    log?.(
      '🔍 Comparing built modules and dependencies with deployed values...',
    );
    log?.(`• Deployed modules (${deployment.modules.length})`);
    log?.(`• Built modules (${details?.builtModules?.length ?? 0})`);

    return {
      success: true,
      message,
      details,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Verification failed with error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
