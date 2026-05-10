import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildQuiltResourceUrl, readResource } from '../readBlob';

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);

describe('readResource', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds quilt resource URLs with the path as one encoded identifier segment', () => {
    expect(
      buildQuiltResourceUrl('https://aggregator.example', {
        blobId: 'quilt-id',
        path: '/.well-known/walrus-sites.intoto.jsonl',
      }),
    ).toBe(
      'https://aggregator.example/v1/blobs/by-quilt-id/quilt-id/%2F.well-known%2Fwalrus-sites.intoto.jsonl',
    );
  });

  it('loads Walrus Sites quilt resources through the quilt identifier API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(bytes('{"ok":true}\n')));
    vi.stubGlobal('fetch', fetchMock);

    const result = await readResource({
      path: '/.well-known/walrus-sites.intoto.jsonl',
      blobId: 'quilt-id',
      headers: {
        'x-wal-quilt-patch-internal-id': '0x0102000f00',
      },
    });

    expect(new TextDecoder().decode(result)).toBe('{"ok":true}\n');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://aggregator.walrus-mainnet.walrus.space/v1/blobs/by-quilt-id/quilt-id/%2F.well-known%2Fwalrus-sites.intoto.jsonl',
    );
  });

  it('keeps the raw blob fallback for non-quilt resources', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(bytes('abcdef')));
    vi.stubGlobal('fetch', fetchMock);

    const result = await readResource({
      path: '/legacy.txt',
      blobId: 'blob-id',
      range: {
        start: 1,
        end: 3,
      },
    });

    expect(new TextDecoder().decode(result)).toBe('bcd');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://aggregator.walrus-mainnet.walrus.space/v1/blobs/blob-id',
    );
  });
});
