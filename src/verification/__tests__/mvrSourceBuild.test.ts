import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  parseDeploymentContext,
  type DeploymentContext,
  type LoadedDeploymentTransaction,
} from '../mvrDeployment';
import {
  compareMoveBytecode,
  verifyMvrSourceBuild,
  type VerifyMvrSourceBuildAdapters,
} from '../mvrSourceBuild';

const PACKAGE_ADDRESS = '0xabc';
const DEPENDENCY =
  '0x0000000000000000000000000000000000000000000000000000000000000002';

const loadedTransaction: LoadedDeploymentTransaction = {
  rawTransactionBytes: new Uint8Array([1]),
  createdImmutableAddresses: [PACKAGE_ADDRESS],
};

const publishDeployment: DeploymentContext = {
  kind: 'publish',
  commandIndex: 0,
  modules: ['module-a'],
  dependencies: [DEPENDENCY],
};

const upgradeDeployment: DeploymentContext = {
  kind: 'upgrade',
  commandIndex: 0,
  modules: ['module-a'],
  dependencies: [DEPENDENCY],
  upgradePackageId:
    '0x00000000000000000000000000000000000000000000000000000000000000aa',
};

const createInput = () => ({
  repoUrl: 'https://github.com/example/package',
  tag: 'v1.0.0',
  path: 'move',
  packageAddress: PACKAGE_ADDRESS,
  txDigest: 'tx-digest',
  network: 'mainnet' as const,
  githubToken: 'ghp_token',
});

const createAdapters = (
  deployment: DeploymentContext,
  transaction: LoadedDeploymentTransaction = loadedTransaction,
): Required<
  Pick<
    VerifyMvrSourceBuildAdapters,
    'fetchSource' | 'loadTransaction' | 'parseDeployment'
  >
> => ({
  fetchSource: vi.fn(async () => ({
    files: {
      'Move.toml': '[package]\nname = "example"',
      'sources/example.move': 'module example::example {}',
    },
    rootGit: {
      git: 'https://github.com/example/package.git',
      rev: 'v1.0.0',
      subdir: 'move',
    },
  })),
  loadTransaction: vi.fn(async () => transaction),
  parseDeployment: vi.fn(() => deployment),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('deployment command parsing', () => {
  it('fails ambiguous deployment transactions', () => {
    expect(() =>
      parseDeploymentContext([
        {
          $kind: 'Publish',
          Publish: { modules: [], dependencies: [] },
        },
        {
          $kind: 'Upgrade',
          Upgrade: {
            modules: [],
            dependencies: [],
            package: upgradeDeployment.upgradePackageId!,
          },
        },
      ]),
    ).toThrow('Ambiguous deployment transaction');
  });
});

describe('bytecode comparison', () => {
  it('keeps the existing module mismatch result shape', () => {
    const comparison = compareMoveBytecode({
      builtModules: ['built-a', 'built-b'],
      deployedModules: ['deployed-a'],
      builtDependencies: [DEPENDENCY],
      deployedDependencies: [DEPENDENCY],
    });

    expect(comparison.success).toBe(false);
    expect(comparison.message).toContain('Module count mismatch');
    expect(comparison.details.matchingModules).toBe(0);
    expect(comparison.details.totalModules).toBe(1);
  });
});

describe('MVR source build verification', () => {
  it('uses the verification WASM for publish transactions and preserves the result shape', async () => {
    const adapters = createAdapters(publishDeployment);
    const verifyProvenance = vi.fn(async () => ({
      status: 'verified' as const,
      verdict: 'exact_bytecode_match' as const,
      summary: 'Exact bytecode match',
      currentBuild: {
        modules: ['module-a'],
        dependencies: [DEPENDENCY],
        digest: [1, 2, 3],
      },
    }));

    vi.stubGlobal('window', {});

    const result = await verifyMvrSourceBuild(createInput(), {
      ...adapters,
      verifyProvenance,
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe(
      'Source code verification successful! Modules and dependencies match.',
    );
    expect(result.details?.deploymentKind).toBe('publish');
    expect(result.details?.buildIntent).toBe('publish');
    expect(result.details?.verificationStatus).toBe('verified');
    expect(result.details?.verificationVerdict).toBe('exact_bytecode_match');
    expect(result.details?.verificationSummary).toBe('Exact bytecode match');
    expect(verifyProvenance).toHaveBeenCalledWith(
      expect.objectContaining({
        files: {
          'Move.toml': '[package]\nname = "example"',
          'sources/example.move': 'module example::example {}',
        },
        rootGit: {
          git: 'https://github.com/example/package.git',
          rev: 'v1.0.0',
          subdir: 'move',
        },
        githubToken: 'ghp_token',
        intent: 'publish',
        network: 'mainnet',
        verifierAssetBaseUrl: '/assets',
        reference: {
          modules: ['module-a'],
          dependencies: [DEPENDENCY],
          packageId: PACKAGE_ADDRESS,
        },
      }),
    );
    expect(adapters.fetchSource).toHaveBeenCalledWith(
      'https://github.com/example/package/tree/v1.0.0/move',
      { githubToken: 'ghp_token' },
    );
  });

  it('verifies upgrade transactions against Upgrade.package without requiring a created immutable object', async () => {
    const adapters = createAdapters(upgradeDeployment, {
      ...loadedTransaction,
      createdImmutableAddresses: [],
    });
    const verifyProvenance = vi.fn(async () => ({
      status: 'verified' as const,
      verdict: 'exact_bytecode_match' as const,
      currentBuild: {
        modules: ['module-a'],
        dependencies: [DEPENDENCY],
        digest: [1],
      },
    }));

    const result = await verifyMvrSourceBuild(
      {
        ...createInput(),
        packageAddress: upgradeDeployment.upgradePackageId!,
      },
      {
        ...adapters,
        verifyProvenance,
      },
    );

    expect(result.success).toBe(true);
    expect(result.details?.deploymentKind).toBe('upgrade');
    expect(result.details?.upgradePackageId).toBe(
      upgradeDeployment.upgradePackageId,
    );
    expect(verifyProvenance).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: 'upgrade',
        reference: {
          modules: ['module-a'],
          dependencies: [DEPENDENCY],
        },
      }),
    );
  });

  it('surfaces provenance bytecode mismatches with comparison details', async () => {
    const adapters = createAdapters(publishDeployment);
    const result = await verifyMvrSourceBuild(createInput(), {
      ...adapters,
      verifyProvenance: vi.fn(async () => ({
        status: 'mismatch' as const,
        verdict: 'semantic_mismatch' as const,
        currentBuild: {
          modules: ['different-module'],
          dependencies: [DEPENDENCY],
          digest: '0x12',
        },
        differences: ['module bytecode differs'],
      })),
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe(
      'Source verification mismatch: rebuilt bytecode does not match deployed bytecode.',
    );
    expect(result.details?.verificationStatus).toBe('mismatch');
    expect(result.details?.verificationVerdict).toBe('semantic_mismatch');
    expect(result.details?.matchingModules).toBe(0);
    expect(result.details?.differences).toEqual(['module bytecode differs']);
  });

  it('surfaces bytecode version mismatch evidence without treating it as verified', async () => {
    const adapters = createAdapters(publishDeployment);
    const candidatesConsidered = [
      {
        verifierId: 'sui-1.70.2',
        suiVersion: '1.70.2',
        outcome: 'selected' as const,
        status: 'bytecode_version_mismatch' as const,
        verdict: 'bytecode_version_header_mismatch' as const,
      },
    ];
    const result = await verifyMvrSourceBuild(createInput(), {
      ...adapters,
      verifyProvenance: vi.fn(async () => ({
        status: 'bytecode_version_mismatch' as const,
        verdict: 'bytecode_version_header_mismatch' as const,
        summary: 'Reference bytecode version differs from verifier output',
        displayMessage:
          'Verification failed using verifier sui-1.70.2 for decoded bytecode version 7: Reference bytecode version differs from verifier output',
        selectedVerifier: {
          verifierId: 'sui-1.70.2',
          suiVersion: '1.70.2',
          decodedBytecodeVersion: 7,
          bytecodeFlavor: 5,
        },
        candidatesConsidered,
        referenceBytecode: {
          decodedVersion: 7,
          flavor: 5,
          moduleCount: 1,
        },
        sourceCompatibility: {
          supportedEditions: ['legacy', '2024.alpha', '2024.beta', '2024'],
          defaultEdition: '2024',
          root: {
            source: 'root' as const,
            packageName: 'example',
            manifestPath: 'Move.toml',
            effectiveEdition: '2024',
            defaulted: true,
            supported: true,
          },
          dependencies: [],
          unsupportedEditions: [],
        },
        bytecodeHeaderEvidence: {
          source: 'binary_header' as const,
          reference: [{ version: 6 }],
          currentBuild: [{ version: 7 }],
          currentVerifierSuiVersion: '1.70.2',
          referenceCliVersion: '1.26.2',
        },
        currentBuild: {
          modules: ['module-a'],
          dependencies: [DEPENDENCY],
          digest: '0x12',
        },
        differences: ['bytecode version header differs'],
        bytecodeDiffs: [
          {
            module: 'example',
            classification: 'bytecode_version_header_mismatch' as const,
            rawBytesMatch: false,
            semanticMatch: true,
            rootAddressSubstitutionApplied: false,
            sameExceptVersionWord: true,
            identity: { matches: true },
            shape: { matches: true },
            reference: {
              length: 10,
              version: 7,
              sha256: 'reference-sha',
            },
            currentBuild: {
              length: 10,
              version: 8,
              sha256: 'current-sha',
            },
          },
        ],
      })),
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe(
      'Bytecode version mismatch: this verifier cannot prove byte-for-byte provenance for the reference bytecode version.',
    );
    expect(result.details?.verificationStatus).toBe(
      'bytecode_version_mismatch',
    );
    expect(result.details?.verificationVerdict).toBe(
      'bytecode_version_header_mismatch',
    );
    expect(result.details?.verificationSummary).toContain(
      'Reference bytecode version',
    );
    expect(result.details?.bytecodeDiffs).toHaveLength(1);
    expect(
      result.details?.bytecodeHeaderEvidence?.currentVerifierSuiVersion,
    ).toBe('1.70.2');
    expect(result.details?.selectedVerifier?.verifierId).toBe('sui-1.70.2');
    expect(result.details?.candidatesConsidered).toEqual(candidatesConsidered);
    expect(result.details?.referenceBytecode?.decodedVersion).toBe(7);
    expect(result.details?.sourceCompatibility?.root?.effectiveEdition).toBe(
      '2024',
    );
  });

  it('logs structured dependency fetch failures from verifier progress events once', async () => {
    const adapters = createAdapters(publishDeployment);
    const logs: string[] = [];
    const verifyProvenance = vi.fn(async (input) => {
      input.onProgress?.({
        type: 'fetch_failed',
        dependencyName: 'Pyth',
        source: {
          type: 'git',
          git: 'https://github.com/pyth-network/pyth-crosschain.git',
          rev: 'sui-contract-mainnet',
          subdir: 'target_chains/sui/contracts',
        },
        parentPackageName: 'deeptrade_core',
        error: 'GitHub returned 404',
        code: 'github_not_found',
      });

      return {
        status: 'build_failure' as const,
        failureStage: 'dependency_resolution' as const,
        verdict: 'unverified' as const,
        error: 'Failed to resolve dependencies',
      };
    });

    const result = await verifyMvrSourceBuild(
      { ...createInput(), log: (message) => logs.push(message) },
      {
        ...adapters,
        verifyProvenance,
      },
    );

    expect(result.success).toBe(false);
    expect(logs).toEqual(
      expect.arrayContaining([
        '❌ Source fetch failed: Pyth (https://github.com/pyth-network/pyth-crosschain.git@sui-contract-mainnet/target_chains/sui/contracts)',
        '• Parent package: deeptrade_core',
        '• Failure code: github_not_found',
        '• GitHub returned 404',
        '❌ Verification failed (status=build_failure, stage=dependency_resolution, verdict=unverified)',
      ]),
    );
    expect(
      logs.filter((message) => message.startsWith('❌ Verification failed')),
    ).toHaveLength(1);
  });

  it('keeps strict publish failures in the normal verification result flow', async () => {
    const adapters = createAdapters(publishDeployment);
    const result = await verifyMvrSourceBuild(createInput(), {
      ...adapters,
      verifyProvenance: vi.fn(async () => ({
        status: 'build_failure' as const,
        failureStage: 'compile' as const,
        error: 'Package is already published for mainnet',
      })),
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to build Move package');
    expect(result.error).toContain('already published');
    expect(result.details?.deploymentKind).toBe('publish');
    expect(result.details?.verificationStatus).toBe('build_failure');
    expect(result.details?.failureStage).toBe('compile');
  });

  it('preserves package address mismatch failure', async () => {
    const adapters = createAdapters(publishDeployment);
    const verifyProvenance = vi.fn(async () => ({
      status: 'verified' as const,
      currentBuild: {
        modules: ['module-a'],
        dependencies: [DEPENDENCY],
        digest: [],
      },
    }));
    const result = await verifyMvrSourceBuild(
      { ...createInput(), packageAddress: '0xdef' },
      {
        ...adapters,
        verifyProvenance,
      },
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('Package address does not match');
    expect(result.error).toBe('Address mismatch');
    expect(verifyProvenance).not.toHaveBeenCalled();
  });
});
