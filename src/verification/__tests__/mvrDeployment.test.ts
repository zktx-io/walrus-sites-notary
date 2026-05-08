import { toBase64 } from '@mysten/sui/utils';
import { describe, expect, it, vi } from 'vitest';

import {
  createDeploymentTransactionLoader,
  deploymentTargetsPackage,
  hasCreatedImmutableAddress,
  parseDeploymentContext,
} from '../mvrDeployment';

const encoder = new TextEncoder();

describe('MVR deployment parser', () => {
  it('parses publish deployments', () => {
    const deployment = parseDeploymentContext([
      {
        $kind: 'Publish',
        Publish: { modules: ['module-a'], dependencies: ['0x2'] },
      },
    ]);

    expect(deployment.kind).toBe('publish');
    expect(deployment.modules).toEqual(['module-a']);
    expect(deployment.dependencies).toEqual(['0x2']);
  });

  it('parses upgrade deployments with the upgraded package id', () => {
    const deployment = parseDeploymentContext([
      {
        $kind: 'Upgrade',
        Upgrade: {
          modules: ['module-a'],
          dependencies: ['0x2'],
          package: '0xabc',
        },
      },
    ]);

    expect(deployment.kind).toBe('upgrade');
    expect(deployment.upgradePackageId).toBe('0xabc');
  });

  it('fails when no deployment command exists', () => {
    expect(() =>
      parseDeploymentContext([{ $kind: 'MoveCall' }]),
    ).toThrow('No Publish or Upgrade command found');
  });
});

describe('MVR deployment transaction loader', () => {
  it('matches created immutable addresses after Sui object id normalization', () => {
    expect(
      hasCreatedImmutableAddress(
        {
          createdImmutableAddresses: [
            '0x0000000000000000000000000000000000000000000000000000000000000abc',
          ],
        },
        '0xabc',
      ),
    ).toBe(true);
  });

  it('matches upgrade deployments by Upgrade.package without created immutable objects', () => {
    const deployment = parseDeploymentContext([
      {
        $kind: 'Upgrade',
        Upgrade: {
          modules: ['module-a'],
          dependencies: ['0x2'],
          package:
            '0x0000000000000000000000000000000000000000000000000000000000000abc',
        },
      },
    ]);

    expect(
      deploymentTargetsPackage(
        deployment,
        { createdImmutableAddresses: [] },
        '0xabc',
      ),
    ).toBe(true);
  });

  it('uses gRPC transaction bytes and effects when available', async () => {
    const getTransaction = vi.fn(async () => ({
      $kind: 'Transaction' as const,
      Transaction: {
        bcs: new Uint8Array([1, 2, 3]),
        effects: {
          changedObjects: [
            {
              idOperation: 'Created',
              outputOwner: 'Immutable',
              objectId: '0xabc',
            },
          ],
        },
      },
    }));
    const graphQLQuery = vi.fn();
    const loader = createDeploymentTransactionLoader({
      createGrpcClient: () => ({ getTransaction }),
      createGraphQLClient: () => ({ query: graphQLQuery }),
      cache: new Map(),
    });

    const loaded = await loader('mainnet', 'tx-digest');

    expect(loaded.rawTransactionBytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(loaded.createdImmutableAddresses).toEqual(['0xabc']);
    expect(graphQLQuery).not.toHaveBeenCalled();
  });

  it('falls back to GraphQL when gRPC misses', async () => {
    const getTransaction = vi.fn(async () => ({
      $kind: 'Transaction' as const,
      Transaction: { bcs: new Uint8Array(), effects: {} },
    }));
    const graphQLQuery = vi.fn(async () => ({
      data: {
        transaction: {
          transactionBcs: toBase64(encoder.encode('transaction-bytes')),
          effects: {
            objectChanges: {
              nodes: [
                {
                  idCreated: true,
                  outputState: {
                    address: '0xabc',
                    owner: { __typename: 'Immutable' },
                  },
                },
              ],
            },
          },
        },
      },
    }));
    const loader = createDeploymentTransactionLoader({
      createGrpcClient: () => ({ getTransaction }),
      createGraphQLClient: () => ({ query: graphQLQuery }),
      cache: new Map(),
    });

    const loaded = await loader('mainnet', 'tx-digest');

    expect(new TextDecoder().decode(loaded.rawTransactionBytes)).toBe(
      'transaction-bytes',
    );
    expect(loaded.createdImmutableAddresses).toEqual(['0xabc']);
    expect(graphQLQuery).toHaveBeenCalledTimes(1);
  });

  it('throws a concrete loader error when both stages miss', async () => {
    const loader = createDeploymentTransactionLoader({
      createGrpcClient: () => ({
        getTransaction: vi.fn(async () => {
          throw new Error('grpc down');
        }),
      }),
      createGraphQLClient: () => ({
        query: vi.fn(async () => ({ data: { transaction: null } })),
      }),
      cache: new Map(),
    });

    await expect(loader('mainnet', 'tx-digest')).rejects.toThrow(
      'transaction not found/pruned',
    );
  });

  it('caches successful loads by network and digest', async () => {
    const getTransaction = vi.fn(async () => ({
      $kind: 'Transaction' as const,
      Transaction: {
        bcs: new Uint8Array([1]),
        effects: { changedObjects: [] },
      },
    }));
    const loader = createDeploymentTransactionLoader({
      createGrpcClient: () => ({ getTransaction }),
      createGraphQLClient: () => ({ query: vi.fn() }),
      cache: new Map(),
    });

    const first = await loader('mainnet', 'tx-digest');
    first.rawTransactionBytes[0] = 9;
    const second = await loader('mainnet', 'tx-digest');

    expect(second.rawTransactionBytes[0]).toBe(1);
    expect(getTransaction).toHaveBeenCalledTimes(1);
  });
});
