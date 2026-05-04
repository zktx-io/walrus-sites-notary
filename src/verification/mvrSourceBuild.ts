import { normalizeSuiObjectId } from '@mysten/sui/utils';
import { bytesToHex } from '@noble/hashes/utils';
import {
  fetchMovePackageFromGitHub,
  initMovePackageBuilder,
  prepareMovePackagePublish,
  prepareMovePackageUpgrade,
  type MovePackageFailure,
  type MovePackageInput,
  type MovePackageProgressEvent,
  type MovePackagePublishSuccess,
  type MovePackageUpgradeInput,
  type MovePackageUpgradeSuccess,
} from '@zktx.io/sui-move-builder';

import { Network } from '../utils/suiClient';

import {
  DeploymentContext,
  DeploymentKind,
  hasCreatedImmutableAddress,
  LoadedDeploymentTransaction,
  loadDeploymentTransaction,
  parseDeploymentContextFromBytes,
} from './mvrDeployment';

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

type MovePackageBuildSuccess =
  | MovePackagePublishSuccess
  | MovePackageUpgradeSuccess;

interface BuildMovePackageAdapters {
  preparePublish?: (
    input: MovePackageInput,
  ) => Promise<MovePackagePublishSuccess | MovePackageFailure>;
  prepareUpgrade?: (
    input: MovePackageUpgradeInput,
  ) => Promise<MovePackageUpgradeSuccess | MovePackageFailure>;
}

export interface VerifyMvrSourceBuildAdapters
  extends BuildMovePackageAdapters {
  fetchSource?: (
    url: string,
    options?: { githubToken?: string },
  ) => Promise<Record<string, string>>;
  initBuilder?: typeof initMovePackageBuilder;
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

let compilerInitialized = false;

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
    default:
      log(`[progress] ${JSON.stringify(event)}`);
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

async function initializeCompiler(
  log: ((message: string) => void) | undefined,
  initBuilder: typeof initMovePackageBuilder,
) {
  if (compilerInitialized) {
    log?.('✓ Move compiler already initialized');
    return;
  }

  log?.('⚙️  Initializing Move compiler...');
  try {
    await initBuilder();
    compilerInitialized = true;
    log?.('✓ Move compiler initialized');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log?.(`❌ WASM initialization failed: ${errorMessage}`);
    throw new Error(`Failed to initialize Move compiler: ${errorMessage}`);
  }
}

async function buildMovePackageForDeployment(
  deployment: DeploymentContext,
  commonInput: MovePackageInput,
  adapters: BuildMovePackageAdapters,
): Promise<MovePackageBuildSuccess | MovePackageFailure> {
  if (deployment.kind === 'publish') {
    return (adapters.preparePublish ?? prepareMovePackagePublish)(commonInput);
  }

  return (adapters.prepareUpgrade ?? prepareMovePackageUpgrade)({
    ...commonInput,
    packageId: deployment.upgradePackageId,
  });
}

const createdPackageFailure = (
  packageAddress: string,
  loadedTransaction: LoadedDeploymentTransaction,
): VerificationResult | null => {
  if (loadedTransaction.createdImmutableAddresses.length === 0) {
    return {
      success: false,
      message: 'Transaction not found or has no created immutable objects',
      error: 'Invalid transaction',
    };
  }

  if (!hasCreatedImmutableAddress(loadedTransaction, packageAddress)) {
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
    if (githubToken) {
      log?.('🔐 Using provided GitHub token for GitHub API calls');
    } else {
      log?.(
        'ℹ️ No GitHub token provided; falling back to anonymous GitHub API limits',
      );
    }

    const fetchSource = adapters.fetchSource ?? fetchMovePackageFromGitHub;
    const files = await fetchSource(`${repoUrl}/tree/${tag}/${path}`, {
      githubToken,
    });

    log?.('🔗 Fetching deployed bytecode from Sui blockchain...');
    const loadedTransaction = await (
      adapters.loadTransaction ?? loadDeploymentTransaction
    )(network, txDigest);
    log?.('✓ Transaction data retrieved');

    const packageFailure = createdPackageFailure(
      packageAddress,
      loadedTransaction,
    );
    if (packageFailure) return packageFailure;

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

    await initializeCompiler(log, adapters.initBuilder ?? initMovePackageBuilder);

    log?.(
      `🔨 Building Move package with ${deployment.kind} intent...`,
    );
    const buildResult = await buildMovePackageForDeployment(
      deployment,
      {
        files,
        ansiColor: true,
        network,
        githubToken,
        onProgress: (event) => logProgressEvent(event, log),
      },
      adapters,
    );

    if ('error' in buildResult) {
      log?.('❌ Build failed');
      return {
        success: false,
        message: 'Failed to build Move package',
        error: buildResult.error,
        details: {
          deploymentKind: deployment.kind,
          buildIntent: deployment.kind,
          upgradePackageId: deployment.upgradePackageId,
        },
      };
    }

    if (buildResult.intent !== deployment.kind) {
      return {
        success: false,
        message: `Build intent mismatch: built ${buildResult.intent}, expected ${deployment.kind}`,
        error: 'Build intent mismatch',
        details: {
          deploymentKind: deployment.kind,
          buildIntent: buildResult.intent,
          upgradePackageId: deployment.upgradePackageId,
        },
      };
    }

    const builtDigest =
      buildResult.digest.length > 0
        ? bytesToHex(new Uint8Array(buildResult.digest))
        : undefined;

    log?.(`✓ Build successful (${buildResult.modules.length} modules)`);
    if (builtDigest) {
      log?.(`📦 Build digest: ${builtDigest.substring(0, 16)}...`);
    }

    log?.(
      '🔍 Comparing built modules and dependencies with deployed values...',
    );
    log?.(`• Deployed modules (${deployment.modules.length})`);
    log?.(`• Built modules (${buildResult.modules.length})`);

    const comparison = compareMoveBytecode({
      builtModules: buildResult.modules,
      deployedModules: deployment.modules,
      builtDependencies: buildResult.dependencies,
      deployedDependencies: deployment.dependencies,
      builtDigest,
    });

    return {
      success: comparison.success,
      message: comparison.message,
      details: buildDetails(comparison.details, deployment),
    };
  } catch (error) {
    return {
      success: false,
      message: 'Verification failed with error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
