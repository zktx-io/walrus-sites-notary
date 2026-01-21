import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, normalizeSuiObjectId, toBase64 } from '@mysten/sui/utils';
import { bytesToHex } from '@noble/hashes/utils';
import {
  buildMovePackage,
  fetchPackageFromGitHub,
  initMoveCompiler,
} from '@zktx.io/sui-move-builder/lite';

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
  };
  error?: string;
}

// Cache to ensure compiler is initialized only once
let compilerInitialized = false;

/**
 * Verify that the deployed bytecode matches the source code from GitHub
 */
export const verifySourceCode = async (
  repoUrl: string,
  tag: string,
  path: string,
  packageAddress: string,
  txDigest: string,
  network: 'mainnet' | 'testnet' | 'devnet',
  log?: (message: string) => void,
  githubToken?: string,
): Promise<VerificationResult> => {
  try {
    if (githubToken) {
      log?.('🔐 Using provided GitHub token for GitHub API calls');
    } else {
      log?.(
        'ℹ️ No GitHub token provided; falling back to anonymous GitHub API limits',
      );
    }

    // Step 1: Fetch all source code files from GitHub (no filter)
    const files = await fetchPackageFromGitHub(
      `${repoUrl}/tree/${tag}/${path}`,
      { githubToken }, // No filter, fetch all files
    );

    // Step 2: Fetch deployed bytecode from Sui blockchain
    log?.('🔗 Fetching deployed bytecode from Sui blockchain...');
    const client = new SuiClient({ url: getFullnodeUrl(network) });
    const receipt = await client.getTransactionBlock({
      digest: txDigest,
      options: { showRawInput: true, showEffects: true },
    });
    log?.('✓ Transaction data retrieved');

    if (!receipt.effects || !receipt.effects.created) {
      return {
        success: false,
        message: 'Transaction not found or has no created objects',
        error: 'Invalid transaction',
      };
    }

    const immutables = receipt.effects.created.find(
      (o) => o.owner === 'Immutable',
    );

    if (!immutables) {
      return {
        success: false,
        message: 'No immutable objects found in transaction',
        error: 'No package object',
      };
    }

    if (immutables.reference.objectId !== packageAddress) {
      return {
        success: false,
        message: 'Package address does not match',
        error: 'Address mismatch',
      };
    }

    const transaction = Transaction.from(
      toBase64(fromBase64(receipt.rawTransaction!).slice(4)),
    );
    const data = transaction.getData();

    const upgrade = data.commands.find((c) => c.$kind === 'Upgrade');
    const publish = data.commands.find((c) => c.$kind === 'Publish');

    let deployedModules: string[] = [];
    let deployedDependencies: string[] = [];

    if (upgrade && upgrade.Upgrade) {
      deployedModules = upgrade.Upgrade['modules'];
      deployedDependencies = upgrade.Upgrade['dependencies'];
      log?.(
        `✓ Found Upgrade command with ${deployedDependencies.length} dependencies`,
      );
      log?.(`✓ Found Upgrade command with ${deployedModules.length} modules`);
    } else if (publish && publish.Publish) {
      deployedModules = publish.Publish['modules'];
      deployedDependencies = publish.Publish['dependencies'];
      log?.(
        `✓ Found Publish command with ${deployedDependencies.length} dependencies`,
      );
      log?.(`✓ Found Publish command with ${deployedModules.length} modules`);
    } else {
      log?.('❌ No Publish or Upgrade command found');
      return {
        success: false,
        message: 'No Publish or Upgrade command found in transaction',
        error: 'Invalid transaction type',
      };
    }

    // Step 3: Initialize Move compiler - only once
    if (!compilerInitialized) {
      log?.('⚙️  Initializing Move compiler...');
      try {
        await initMoveCompiler();
        compilerInitialized = true;
        log?.('✓ Move compiler initialized');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        log?.(`❌ WASM initialization failed: ${errorMsg}`);
        throw new Error(`Failed to initialize Move compiler: ${errorMsg}`);
      }
    } else {
      log?.('✓ Move compiler already initialized');
    }

    // Step 4: Build the Move package
    log?.('🔨 Building Move package...');
    const buildResult = await buildMovePackage({
      files,
      ansiColor: true,
      network,
      githubToken,
    });

    if ('error' in buildResult) {
      log?.('❌ Build failed');
      return {
        success: false,
        message: 'Failed to build Move package',
        error: buildResult.error,
      };
    }

    const builtModules = buildResult.modules || [];
    const builtDependencies = buildResult.dependencies || [];
    const rawDigestBytes = buildResult.digest || [];
    const builtDigest =
      rawDigestBytes.length > 0
        ? bytesToHex(new Uint8Array(rawDigestBytes))
        : undefined;

    log?.(`✓ Build successful (${builtModules.length} modules)`);
    if (builtDigest) {
      log?.(`📦 Build digest: ${builtDigest.substring(0, 16)}...`);
    }

    const normalizedBuiltDependencies = builtDependencies.map((dep) =>
      normalizeSuiObjectId(dep),
    );
    const normalizedDeployedDependencies = deployedDependencies.map((dep) =>
      normalizeSuiObjectId(dep),
    );

    // Step 6: Compare built modules and dependencies with deployed values
    log?.(
      '🔍 Comparing built modules and dependencies with deployed values...',
    );
    log?.(`• Deployed modules (${deployedModules.length})`);
    log?.(`• Built modules (${builtModules.length})`);

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

    // Compare in original order; do not sort to preserve deployment order
    let matchingCount = 0;
    for (let i = 0; i < builtModules.length; i++) {
      if (builtModules[i] === deployedModules[i]) {
        matchingCount++;
      }
    }

    if (
      normalizedBuiltDependencies.length !==
      normalizedDeployedDependencies.length
    ) {
      return {
        success: false,
        message: `Dependency count mismatch: built ${normalizedBuiltDependencies.length}, deployed ${normalizedDeployedDependencies.length}`,
        details: {
          builtModules,
          deployedModules,
          builtDependencies: normalizedBuiltDependencies,
          deployedDependencies: normalizedDeployedDependencies,
          builtDigest,
          matchingModules: matchingCount,
          totalModules: builtModules.length,
          matchingDependencies: 0,
          totalDependencies: normalizedDeployedDependencies.length,
        },
      };
    }

    let matchingDependencies = 0;
    for (let i = 0; i < normalizedBuiltDependencies.length; i++) {
      if (
        normalizedBuiltDependencies[i] === normalizedDeployedDependencies[i]
      ) {
        matchingDependencies++;
      }
    }

    const modulesMatch = matchingCount === builtModules.length;
    const dependenciesMatch =
      matchingDependencies === normalizedBuiltDependencies.length;
    const allMatch = modulesMatch && dependenciesMatch;

    return {
      success: allMatch,
      message: allMatch
        ? 'Source code verification successful! Modules and dependencies match.'
        : `Partial match: modules ${matchingCount}/${builtModules.length}, dependencies ${matchingDependencies}/${normalizedBuiltDependencies.length} match`,
      details: {
        builtModules,
        deployedModules,
        builtDependencies: normalizedBuiltDependencies,
        deployedDependencies: normalizedDeployedDependencies,
        builtDigest,
        matchingModules: matchingCount,
        totalModules: builtModules.length,
        matchingDependencies,
        totalDependencies: normalizedBuiltDependencies.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Verification failed with error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
