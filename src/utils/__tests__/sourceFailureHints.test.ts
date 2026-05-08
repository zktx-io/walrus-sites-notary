import { describe, expect, it } from 'vitest';

import { extractSourceFailureHints } from '../sourceFailureHints';

describe('extractSourceFailureHints', () => {
  it('extracts dependency source from builder errors', () => {
    expect(
      extractSourceFailureHints(
        "Dependency 'DeepBook' from https://github.com/MystenLabs/sui.git@mainnet-v1.70.2/crates/sui-framework/packages/deepbook returned no files",
      ),
    ).toEqual([
      "Dependency DeepBook: https://github.com/MystenLabs/sui.git@mainnet-v1.70.2/crates/sui-framework/packages/deepbook returned no files",
      'GitHub source: MystenLabs/sui.git@mainnet-v1.70.2/crates/sui-framework/packages/deepbook',
    ]);
  });

  it('extracts raw GitHub file URLs', () => {
    expect(
      extractSourceFailureHints(
        'Failed to fetch file: https://raw.githubusercontent.com/org/repo/main/packages/app/Move.toml',
      ),
    ).toEqual(['GitHub file: org/repo/main/packages/app/Move.toml']);
  });

  it('falls back to the root package when no exact source is present', () => {
    expect(
      extractSourceFailureHints('Failed to fetch tree: Not Found', {
        repoUrl: 'https://github.com/org/repo',
        tag: 'main',
        path: 'packages/app',
      }),
    ).toEqual(['Root package: https://github.com/org/repo/tree/main/packages/app']);
  });
});
