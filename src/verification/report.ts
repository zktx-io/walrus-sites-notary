import {
  ArtifactKind,
  ArtifactReport,
  CheckReport,
  IdentityPolicyReport,
  SigstoreReport,
  VerificationReport,
  VerificationStatus,
} from './types';

export const createCheckReport = (
  label: string,
  status: VerificationStatus,
  failureReasons: string[] = [],
  details?: CheckReport['details'],
): CheckReport => ({
  valid: status === 'passed',
  status,
  label,
  failureReasons,
  details,
});

export const createMissingProvenanceReport = (
  kind: ArtifactKind,
  reason = 'No provenance bundle was found.',
): VerificationReport => {
  const sigstore: SigstoreReport = {
    valid: false,
    status: 'failed',
    signature: createCheckReport('DSSE signature', 'failed', [reason]),
    certificate: createCheckReport('Fulcio certificate', 'failed', [reason]),
    transparencyLog: createCheckReport('Rekor transparency log', 'failed', [
      reason,
    ]),
    trustedRoot: createCheckReport('Sigstore trusted root', 'failed', [reason]),
    failureReasons: [reason],
  };

  const identity: IdentityPolicyReport = {
    valid: false,
    status: 'failed',
    failureReasons: [reason],
  };

  const artifact: ArtifactReport = {
    valid: false,
    status: 'unavailable',
    kind,
    summary: 'Provenance unavailable',
    matched: 0,
    total: 0,
    failureReasons: [reason],
  };

  return composeVerificationReport({ sigstore, identity, artifact });
};

export const composeVerificationReport = ({
  provenance,
  sigstore,
  identity,
  artifact,
}: {
  provenance?: VerificationReport['provenance'];
  sigstore: SigstoreReport;
  identity: IdentityPolicyReport;
  artifact: ArtifactReport;
}): VerificationReport => {
  const failureReasons = [
    ...sigstore.failureReasons,
    ...identity.failureReasons,
    ...artifact.failureReasons,
  ];
  const visibleFailureReasons = [
    ...(sigstore.status === 'failed' ? sigstore.failureReasons : []),
    ...(identity.status === 'failed' ? identity.failureReasons : []),
    ...(artifact.status === 'failed' ? artifact.failureReasons : []),
  ].filter((reason, index, reasons) => reasons.indexOf(reason) === index);
  const verified = sigstore.valid && identity.valid && artifact.valid;

  return {
    verified,
    provenance,
    sigstore,
    identity,
    artifact,
    failureReasons,
    visibleFailureReasons,
  };
};
