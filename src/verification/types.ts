import { JsonLPayload } from '../utils/parseJsonl';

export type VerificationStatus = 'passed' | 'failed' | 'unavailable';

export interface CheckReport {
  valid: boolean;
  status: VerificationStatus;
  label: string;
  failureReasons: string[];
  details?: Record<string, string | number | boolean | undefined>;
}

export interface SigstoreReport {
  valid: boolean;
  status: VerificationStatus;
  signature: CheckReport;
  certificate: CheckReport;
  transparencyLog: CheckReport;
  trustedRoot: CheckReport;
  logIndex?: number;
  failureReasons: string[];
}

export interface IdentityPolicyReport {
  valid: boolean;
  status: VerificationStatus;
  expectedRepository?: string;
  statementRepository?: string;
  certificateIdentity?: string;
  issuer?: string;
  failureReasons: string[];
}

export type ArtifactKind = 'site' | 'mvr';

export type ArtifactResourceStatus =
  | 'hash_matched'
  | 'hash_mismatch'
  | 'ignored'
  | 'unknown';

export interface ArtifactResourceReport {
  path: string;
  status: ArtifactResourceStatus;
  expectedHash?: string;
  actualHash?: string;
  reason?: string;
}

export interface ArtifactReport {
  valid: boolean;
  status: VerificationStatus;
  kind: ArtifactKind;
  summary: string;
  matched: number;
  total: number;
  resources?: ArtifactResourceReport[];
  failureReasons: string[];
}

export interface VerificationReport {
  verified: boolean;
  provenance?: JsonLPayload;
  sigstore: SigstoreReport;
  identity: IdentityPolicyReport;
  artifact: ArtifactReport;
  failureReasons: string[];
  visibleFailureReasons: string[];
}
