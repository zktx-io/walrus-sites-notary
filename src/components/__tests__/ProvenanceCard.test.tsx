import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { createCheckReport } from '../../verification/report';
import { VerificationReport } from '../../verification/types';
import { ProvenanceCard } from '../ProvenanceCard';

const createReport = (logIndex: number): VerificationReport => ({
  verified: false,
  provenance: {
    _type: 'https://in-toto.io/Statement/v0.1',
    predicateType: 'https://slsa.dev/provenance/v0.2',
    subject: [
      {
        name: '/index.html',
        digest: { sha256: 'abc123' },
      },
    ],
    predicate: {
      builder: { id: 'builder' },
      buildType: 'build',
      invocation: {
        configSource: {
          uri: 'git+https://github.com/example/notary@refs/heads/main',
          digest: { sha1: 'commit-sha' },
          entryPoint: '.github/workflows/deploy.yml',
        },
        environment: {
          github_repository: 'example/notary',
          github_run_id: '123',
          github_run_attempt: '1',
        },
      },
    },
    signatures: [],
    tlogEntries: [],
  },
  sigstore: {
    valid: false,
    status: 'unavailable',
    signature: createCheckReport('DSSE signature', 'unavailable'),
    certificate: createCheckReport('Fulcio certificate', 'unavailable'),
    transparencyLog: createCheckReport('Rekor transparency log', 'unavailable'),
    trustedRoot: createCheckReport('Sigstore trusted root', 'unavailable'),
    logIndex,
    failureReasons: [],
  },
  identity: {
    valid: false,
    status: 'unavailable',
    failureReasons: [],
  },
  artifact: {
    valid: true,
    status: 'passed',
    kind: 'site',
    summary: 'Integrity checked',
    matched: 1,
    total: 1,
    failureReasons: [],
  },
  failureReasons: [],
  visibleFailureReasons: [],
});

describe('ProvenanceCard', () => {
  it('renders the public ledger link when logIndex is zero', () => {
    const html = renderToStaticMarkup(
      <ProvenanceCard report={createReport(0)} />,
    );

    expect(html).toContain('Integrity checked');
    expect(html).toContain('View Sigstore entry');
    expect(html).toContain('https://search.sigstore.dev/?logIndex=0');
    expect(html).not.toContain('Public Ledger</div><div class="text-gray-500">:</div><span');
  });
});
