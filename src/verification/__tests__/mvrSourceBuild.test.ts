import { describe, expect, it, vi } from 'vitest';

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
): Required<Pick<VerifyMvrSourceBuildAdapters, 'fetchSource' | 'loadTransaction' | 'parseDeployment' | 'initBuilder'>> => ({
  fetchSource: vi.fn(async () => ({
    'Move.toml': '[package]\nname = "example"',
    'sources/example.move': 'module example::example {}',
  })),
  loadTransaction: vi.fn(async () => loadedTransaction),
  parseDeployment: vi.fn(() => deployment),
  initBuilder: vi.fn(async () => undefined),
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
  it('uses publish intent for publish transactions and preserves the result shape', async () => {
    const adapters = createAdapters(publishDeployment);
    const preparePublish = vi.fn(async () => ({
      intent: 'publish' as const,
      modules: ['module-a'],
      dependencies: [DEPENDENCY],
      digest: [1, 2, 3],
      moveLock: '',
      environment: 'mainnet',
    }));
    const prepareUpgrade = vi.fn(async () => ({
      error: 'upgrade should not be called',
    }));

    const result = await verifyMvrSourceBuild(createInput(), {
      ...adapters,
      preparePublish,
      prepareUpgrade,
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe(
      'Source code verification successful! Modules and dependencies match.',
    );
    expect(result.details?.deploymentKind).toBe('publish');
    expect(result.details?.buildIntent).toBe('publish');
    expect(preparePublish).toHaveBeenCalledTimes(1);
    expect(prepareUpgrade).not.toHaveBeenCalled();
    expect(adapters.fetchSource).toHaveBeenCalledWith(
      'https://github.com/example/package/tree/v1.0.0/move',
      { githubToken: 'ghp_token' },
    );
  });

  it('uses upgrade intent and passes Upgrade.package as packageId', async () => {
    const adapters = createAdapters(upgradeDeployment);
    const prepareUpgrade = vi.fn(async () => ({
      intent: 'upgrade' as const,
      modules: ['module-a'],
      dependencies: [DEPENDENCY],
      digest: [1],
      moveLock: '',
      environment: 'mainnet',
      packageId: upgradeDeployment.upgradePackageId!,
    }));

    const result = await verifyMvrSourceBuild(createInput(), {
      ...adapters,
      preparePublish: vi.fn(async () => ({ error: 'publish should not run' })),
      prepareUpgrade,
    });

    expect(result.success).toBe(true);
    expect(result.details?.deploymentKind).toBe('upgrade');
    expect(result.details?.upgradePackageId).toBe(
      upgradeDeployment.upgradePackageId,
    );
    expect(prepareUpgrade).toHaveBeenCalledWith(
      expect.objectContaining({
        packageId: upgradeDeployment.upgradePackageId,
      }),
    );
  });

  it('keeps strict publish failures in the normal verification result flow', async () => {
    const adapters = createAdapters(publishDeployment);
    const result = await verifyMvrSourceBuild(createInput(), {
      ...adapters,
      preparePublish: vi.fn(async () => ({
        error: 'Package is already published for mainnet',
      })),
      prepareUpgrade: vi.fn(async () => ({
        error: 'upgrade should not be called',
      })),
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to build Move package');
    expect(result.error).toContain('already published');
    expect(result.details?.deploymentKind).toBe('publish');
  });

  it('preserves package address mismatch failure', async () => {
    const adapters = createAdapters(publishDeployment);
    const result = await verifyMvrSourceBuild(
      { ...createInput(), packageAddress: '0xdef' },
      {
        ...adapters,
        preparePublish: vi.fn(async () => ({
          intent: 'publish' as const,
          modules: ['module-a'],
          dependencies: [DEPENDENCY],
          digest: [],
          moveLock: '',
          environment: 'mainnet',
        })),
      },
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('Package address does not match');
    expect(result.error).toBe('Address mismatch');
  });
});
