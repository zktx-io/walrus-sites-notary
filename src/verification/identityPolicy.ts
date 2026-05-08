import { JsonLPayload } from '../utils/parseJsonl';

import { IdentityPolicyReport } from './types';

const GITHUB_REPO_PATTERN = /github\.com[/:]([^/@]+\/[^/@.]+)(?:\.git)?/i;

export const normalizeGitHubRepository = (
  value?: string,
): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  const match = trimmed.match(GITHUB_REPO_PATTERN);
  const repo = match?.[1] ?? trimmed.replace(/^git\+/, '');

  return repo
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/\.git(@.*)?$/, '')
    .replace(/@.*$/, '')
    .toLowerCase();
};

const repositoryFromStatement = (
  statement: JsonLPayload,
): string | undefined => {
  const environmentRepo =
    statement.predicate?.invocation?.environment?.github_repository;
  if (environmentRepo) {
    return normalizeGitHubRepository(environmentRepo);
  }

  const configSource = statement.predicate?.invocation?.configSource?.uri;
  const configSourceRepo = normalizeGitHubRepository(configSource);
  if (configSourceRepo) {
    return configSourceRepo;
  }

  return statement.predicate?.materials
    ?.map((material) => normalizeGitHubRepository(material.uri))
    .find(Boolean);
};

export const verifyStatementIdentityPolicy = ({
  statement,
  expectedRepository,
}: {
  statement: JsonLPayload;
  expectedRepository?: string;
}): IdentityPolicyReport => {
  const expected = normalizeGitHubRepository(expectedRepository);
  const actual = repositoryFromStatement(statement);

  if (!expected) {
    return {
      valid: false,
      status: 'failed',
      expectedRepository,
      statementRepository: actual,
      failureReasons: ['Registered repository metadata is missing.'],
    };
  }

  if (!actual) {
    return {
      valid: false,
      status: 'failed',
      expectedRepository: expected,
      failureReasons: ['Statement repository identity is missing.'],
    };
  }

  if (actual !== expected) {
    return {
      valid: false,
      status: 'failed',
      expectedRepository: expected,
      statementRepository: actual,
      failureReasons: [
        `Statement repository ${actual} does not match registered repository ${expected}.`,
      ],
    };
  }

  return {
    valid: false,
    status: 'unavailable',
    expectedRepository: expected,
    statementRepository: actual,
    failureReasons: [
      'Statement repository matches registered metadata, but certificate identity is not verified in the browser yet.',
    ],
  };
};
