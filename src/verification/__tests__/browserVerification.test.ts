import { toBase64 } from '@mysten/sui/utils';
import { describe, expect, it } from 'vitest';

import { JsonLPayload, parseJsonlBundle } from '../../utils/parseJsonl';
import {
  createMvrArtifactReport,
  verifySiteArtifacts,
} from '../artifacts';
import { createBrowserSigstoreReport } from '../browserSigstore';
import { verifyStatementIdentityPolicy } from '../identityPolicy';
import { composeVerificationReport, createCheckReport } from '../report';
import {
  ArtifactReport,
  IdentityPolicyReport,
  SigstoreReport,
} from '../types';

const createStatement = ({
  repository = 'example/notary',
  hash = 'abc123',
}: {
  repository?: string;
  hash?: string;
} = {}): JsonLPayload => ({
  _type: 'https://in-toto.io/Statement/v0.1',
  predicateType: 'https://slsa.dev/provenance/v0.2',
  subject: [
    {
      name: '/index.html',
      digest: { sha256: hash },
    },
  ],
  predicate: {
    builder: {
      id: 'https://github.com/slsa-framework/slsa-github-generator',
    },
    buildType: 'https://slsa.dev/container-based-build/v0.1',
    invocation: {
      configSource: {
        uri: `git+https://github.com/${repository}@refs/heads/main`,
        digest: { sha1: 'abc' },
        entryPoint: '.github/workflows/deploy.yml',
      },
      environment: {
        github_repository: repository,
        github_run_id: '123',
        github_run_attempt: '1',
      },
    },
  },
  signatures: [{ keyid: '', sig: 'signature' }],
  tlogEntries: [
    {
      logIndex: 1234,
      logID: { keyid: 'rekor' },
      integratedTime: 1,
    },
  ],
});

const createBundleJson = (statement = createStatement()): string =>
  JSON.stringify({
    mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
    dsseEnvelope: {
      payloadType: 'application/vnd.in-toto+json',
      payload: toBase64(new TextEncoder().encode(JSON.stringify(statement))),
      signatures: statement.signatures,
    },
    verificationMaterial: {
      tlogEntries: statement.tlogEntries,
    },
  });

describe('provenance parsing', () => {
  it('keeps the raw Sigstore bundle and decoded statement together', () => {
    const parsed = parseJsonlBundle(createBundleJson());

    expect(parsed.raw).toContain('dsseEnvelope');
    expect(parsed.bundle.dsseEnvelope?.signatures).toHaveLength(1);
    expect(parsed.statement.subject[0]?.digest.sha256).toBe('abc123');
    expect(parsed.statement.tlogEntries?.[0]?.logIndex).toBe(1234);
  });
});

describe('artifact reports', () => {
  it('reports hash matched for site resources', () => {
    const report = verifySiteArtifacts(createStatement(), [
      {
        id: '1',
        path: '/index.html',
        blobId: 'blob',
        blobHash: 'abc123',
      },
    ]);

    expect(report.valid).toBe(true);
    expect(report.summary).toBe('Integrity checked');
    expect(report.resources?.[0]?.status).toBe('hash_matched');
  });

  it('reports hash mismatch for site resources', () => {
    const report = verifySiteArtifacts(createStatement(), [
      {
        id: '1',
        path: '/index.html',
        blobId: 'blob',
        blobHash: 'different',
      },
    ]);

    expect(report.valid).toBe(false);
    expect(report.failureReasons[0]).toContain('/index.html');
    expect(report.resources?.[0]?.status).toBe('hash_mismatch');
  });

  it('wraps MVR bytecode verification in the shared artifact report shape', async () => {
    const report = await createMvrArtifactReport({
      packageAddress: '0x1',
      digest: 'tx',
      statement: createStatement(),
      bytecodeVerifier: async () => true,
    });

    expect(report.valid).toBe(true);
    expect(report.kind).toBe('mvr');
    expect(report.summary).toBe('Integrity checked');
  });
});

describe('frontend-only trust reports', () => {
  it('does not mark Sigstore valid until browser-native verification exists', () => {
    const report = createBrowserSigstoreReport(createStatement());

    expect(report.valid).toBe(false);
    expect(report.status).toBe('unavailable');
    expect(report.logIndex).toBe(1234);
    expect(report.failureReasons.join(' ')).toContain('Browser-native');
  });

  it('treats statement repository matching as partial until certificate identity is verified', () => {
    const report = verifyStatementIdentityPolicy({
      statement: createStatement({ repository: 'example/notary' }),
      expectedRepository: 'https://github.com/example/notary',
    });

    expect(report.valid).toBe(false);
    expect(report.status).toBe('unavailable');
    expect(report.statementRepository).toBe('example/notary');
  });

  it('fails when registered repository metadata does not match the statement', () => {
    const report = verifyStatementIdentityPolicy({
      statement: createStatement({ repository: 'example/notary' }),
      expectedRepository: 'https://github.com/other/repo',
    });

    expect(report.valid).toBe(false);
    expect(report.status).toBe('failed');
    expect(report.failureReasons[0]).toContain('does not match');
  });
});

describe('verification report composition', () => {
  const passedSigstore: SigstoreReport = {
    valid: true,
    status: 'passed',
    signature: createCheckReport('DSSE signature', 'passed'),
    certificate: createCheckReport('Fulcio certificate', 'passed'),
    transparencyLog: createCheckReport('Rekor transparency log', 'passed'),
    trustedRoot: createCheckReport('Sigstore trusted root', 'passed'),
    failureReasons: [],
  };
  const passedIdentity: IdentityPolicyReport = {
    valid: true,
    status: 'passed',
    failureReasons: [],
  };
  const passedArtifact: ArtifactReport = {
    valid: true,
    status: 'passed',
    kind: 'site',
    summary: 'Integrity checked',
    matched: 1,
    total: 1,
    failureReasons: [],
  };

  it('requires Sigstore, identity, and artifact checks to pass', () => {
    const verified = composeVerificationReport({
      provenance: createStatement(),
      sigstore: passedSigstore,
      identity: passedIdentity,
      artifact: passedArtifact,
    });
    const unverified = composeVerificationReport({
      provenance: createStatement(),
      sigstore: createBrowserSigstoreReport(createStatement()),
      identity: passedIdentity,
      artifact: passedArtifact,
    });

    expect(verified.verified).toBe(true);
    expect(unverified.verified).toBe(false);
  });
});
