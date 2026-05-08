import { SiteResourceData } from '../utils/getSiteResources';
import { JsonLPayload } from '../utils/parseJsonl';
import { verifyBytecode } from '../utils/verifyBytecode';

import { ArtifactReport, ArtifactResourceReport } from './types';

const normalizePath = (value: string): string =>
  value.startsWith('/') ? value : `/${value}`;

export const verifySiteArtifacts = (
  statement: JsonLPayload,
  resources: SiteResourceData['resources'],
): ArtifactReport => {
  const relevantResources = resources.filter(
    (res) => !res.path.startsWith('/.well-known/'),
  );

  const resourceReports: ArtifactResourceReport[] = relevantResources.map(
    (res) => {
      const subject = statement.subject.find(
        (candidate) => normalizePath(candidate.name) === res.path,
      );

      if (!subject) {
        return {
          path: res.path,
          status: 'hash_mismatch',
          actualHash: res.blobHash,
          reason: 'No matching provenance subject was found.',
        };
      }

      const matched = subject.digest.sha256 === res.blobHash;

      return {
        path: res.path,
        status: matched ? 'hash_matched' : 'hash_mismatch',
        expectedHash: subject.digest.sha256,
        actualHash: res.blobHash,
        reason: matched ? undefined : 'Resource hash does not match provenance.',
      };
    },
  );

  const matched = resourceReports.filter(
    (resource) => resource.status === 'hash_matched',
  ).length;
  const total = resourceReports.length;
  const valid = total > 0 && matched === total;
  const failureReasons = resourceReports
    .filter((resource) => resource.status === 'hash_mismatch')
    .map((resource) => `${resource.path}: ${resource.reason}`);

  if (total === 0) {
    failureReasons.push('No site resources were available for hash matching.');
  }

  return {
    valid,
    status: valid ? 'passed' : 'failed',
    kind: 'site',
    summary: valid ? 'Integrity checked' : 'Hash mismatch',
    matched,
    total,
    resources: resourceReports,
    failureReasons,
  };
};

export const createMvrArtifactReport = async ({
  packageAddress,
  digest,
  statement,
  bytecodeVerifier = verifyBytecode,
}: {
  packageAddress: string;
  digest: string;
  statement: JsonLPayload;
  bytecodeVerifier?: (
    packageAddress: string,
    digest: string,
    statement: JsonLPayload,
  ) => Promise<boolean>;
}): Promise<ArtifactReport> => {
  try {
    const valid = await bytecodeVerifier(packageAddress, digest, statement);

    return {
      valid,
      status: valid ? 'passed' : 'failed',
      kind: 'mvr',
      summary: valid ? 'Integrity checked' : 'Hash mismatch',
      matched: valid ? 1 : 0,
      total: 1,
      failureReasons: valid
        ? []
        : ['MVR bytecode hash does not match provenance.'],
    };
  } catch (error) {
    return {
      valid: false,
      status: 'failed',
      kind: 'mvr',
      summary: 'Hash check failed',
      matched: 0,
      total: 1,
      failureReasons: [
        error instanceof Error ? error.message : 'MVR bytecode check failed.',
      ],
    };
  }
};
