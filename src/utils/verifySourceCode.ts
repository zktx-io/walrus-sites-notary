import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, normalizeSuiObjectId, toBase64 } from '@mysten/sui/utils';
import { bytesToHex } from '@noble/hashes/utils';
import {
  buildMovePackage,
  fetchPackageFromGitHub,
  initMoveCompiler,
} from '@zktx.io/sui-move-builder/lite';

import { createGrpcClient, createGraphQLClient, Network } from './suiClient';

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

// Two-stage loader for digest-based transaction loading.
// Network is caller-provided (passed in from verifySourceCode for each call site).
async function fetchTxForVerification(
  network: Network,
  txDigest: string,
): Promise<{
  rawTransactionBytes: Uint8Array;
  createdImmutableAddress: string | null;
}> {
  const grpcClient = createGrpcClient(network);
  let grpcReason: unknown = 'miss';

  // Stage 1: gRPC
  try {
    const result = await grpcClient.getTransaction({
      digest: txDigest,
      include: { bcs: true, effects: true },
    });
    const tx =
      result.$kind === 'Transaction'
        ? result.Transaction
        : result.FailedTransaction;
    if (tx.bcs instanceof Uint8Array && tx.bcs.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const changedObjects = (tx.effects as any)?.changedObjects ?? [];
      const immutable = changedObjects.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (o: any) =>
          o.idOperation === 'Created' && o.outputOwner === 'Immutable',
      );
      return {
        rawTransactionBytes: tx.bcs,
        createdImmutableAddress: immutable?.objectId ?? immutable?.id ?? null,
      };
    }
    grpcReason = 'empty bcs';
  } catch (e) {
    grpcReason = e;
  }

  // Stage 2: GraphQL fallback
  const GET_TX_QUERY = `
    query GetTxForVerify($digest: String!) {
      transaction(digest: $digest) {
        transactionBcs
        effects {
          objectChanges {
            nodes {
              idCreated
              outputState {
                address
                owner {
                  __typename
                  ... on Immutable {
                    _: __typename
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  const gqlClient = createGraphQLClient(network);
  const r = await gqlClient.query<
    {
      transaction: {
        transactionBcs: string;
        effects: {
          objectChanges: {
            nodes: {
              idCreated: boolean;
              outputState: {
                address: string;
                owner: { __typename: string } | null;
              } | null;
            }[];
          };
        };
      } | null;
    },
    { digest: string }
  >({ query: GET_TX_QUERY, variables: { digest: txDigest } });

  // Check errors before data per policy.
  if (r.errors?.length) {
    throw new Error(
      `[loader][graphql] errors (network=${network}, stage=graphql, digest=${txDigest}): ${JSON.stringify(r.errors)}`,
    );
  }

  const txData = r.data?.transaction;
  if (!txData?.transactionBcs) {
    throw new Error(
      `[loader] transaction not found/pruned (network=${network}, digest=${txDigest}) after grpc->graphql fallback; grpc=${String(grpcReason)}, graphql=null`,
    );
  }

  const rawTransactionBytes = fromBase64(txData.transactionBcs);
  // objectChanges is a connection type - access via nodes per policy.
  const immutableNode = (
    txData.effects?.objectChanges?.nodes ??
    ([] as {
      idCreated: boolean;
      outputState?: { owner?: { __typename: string }; address: string };
    }[])
  ).find(
    (n) => n.idCreated && n.outputState?.owner?.__typename === 'Immutable',
  );

  return {
    rawTransactionBytes,
    createdImmutableAddress: immutableNode?.outputState?.address ?? null,
  };
}

// TODO[Gate-F]: This file uses two-stage loader with GraphQL transactionBcs and
// objectChanges.nodes (connection type access). Runtime validation required:
// schema introspection, query smoke check, fallback-path execution.

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

    // Step 2: Fetch deployed bytecode from Sui blockchain using two-stage loader.
    log?.('🔗 Fetching deployed bytecode from Sui blockchain...');
    const { rawTransactionBytes, createdImmutableAddress } =
      await fetchTxForVerification(network, txDigest);
    log?.('✓ Transaction data retrieved');

    if (!createdImmutableAddress) {
      return {
        success: false,
        message: 'Transaction not found or has no created immutable objects',
        error: 'Invalid transaction',
      };
    }

    if (createdImmutableAddress !== packageAddress) {
      return {
        success: false,
        message: 'Package address does not match',
        error: 'Address mismatch',
      };
    }

    // Skip the 4-byte envelope prefix to get TransactionData bytes.
    const transaction = Transaction.from(
      toBase64(rawTransactionBytes.slice(4)),
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
      onProgress: (event) => {
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
            log(
              `✅ Dependency resolution complete (${event.count} dependencies)`,
            );
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
      },
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
