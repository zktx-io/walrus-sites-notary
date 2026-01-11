import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { bytesToHex } from '@noble/hashes/utils';
import {
  buildMovePackage,
  fetchPackageFromGitHub,
  initMoveCompiler,
} from '@zktx.io/sui-move-builder';

export interface VerificationResult {
  success: boolean;
  message: string;
  details?: {
    builtModules?: string[];
    deployedModules?: string[];
    builtDigest?: string;
    matchingModules?: number;
    totalModules?: number;
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

    // Step 1: Fetch source code from GitHub
    const files = await fetchPackageFromGitHub(
      `${repoUrl}/tree/${tag}/${path}`,
      { githubToken },
    );

    // Step 2: Initialize Move compiler - only once
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

    // Step 3: Build the Move package
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
    const rawDigestBytes = buildResult.digest || [];
    const builtDigest =
      rawDigestBytes.length > 0
        ? bytesToHex(new Uint8Array(rawDigestBytes))
        : undefined;

    log?.(`✓ Build successful (${builtModules.length} modules)`);
    if (builtDigest) {
      log?.(`📦 Build digest: ${builtDigest.substring(0, 16)}...`);
    }

    // Step 4: Fetch deployed bytecode from Sui blockchain
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

    if (upgrade && upgrade.Upgrade) {
      deployedModules = upgrade.Upgrade['modules'];
      log?.(`✓ Found Upgrade command with ${deployedModules.length} modules`);
    } else if (publish && publish.Publish) {
      deployedModules = publish.Publish['modules'];
      log?.(`✓ Found Publish command with ${deployedModules.length} modules`);
    } else {
      log?.('❌ No Publish or Upgrade command found');
      return {
        success: false,
        message: 'No Publish or Upgrade command found in transaction',
        error: 'Invalid transaction type',
      };
    }

    // Step 6: Compare built modules with deployed modules
    log?.('🔍 Comparing built modules with deployed modules...');

    if (builtModules.length !== deployedModules.length) {
      return {
        success: false,
        message: `Module count mismatch: built ${builtModules.length}, deployed ${deployedModules.length}`,
        details: {
          builtModules,
          deployedModules,
          builtDigest,
          matchingModules: 0,
          totalModules: deployedModules.length,
        },
      };
    }

    const sortedBuilt = [...builtModules].sort();
    const sortedDeployed = [...deployedModules].sort();

    let matchingCount = 0;
    for (let i = 0; i < sortedBuilt.length; i++) {
      if (sortedBuilt[i] === sortedDeployed[i]) {
        matchingCount++;
      }
    }

    const allMatch = matchingCount === sortedBuilt.length;

    return {
      success: allMatch,
      message: allMatch
        ? 'Source code verification successful! All modules match.'
        : `Partial match: ${matchingCount}/${sortedBuilt.length} modules match`,
      details: {
        builtModules: sortedBuilt,
        deployedModules: sortedDeployed,
        builtDigest,
        matchingModules: matchingCount,
        totalModules: sortedBuilt.length,
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
