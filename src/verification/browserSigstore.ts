import { JsonLPayload } from '../utils/parseJsonl';

import { createCheckReport } from './report';
import { SigstoreReport } from './types';

const BROWSER_VERIFIER_PENDING =
  'Browser-native Sigstore verification is not implemented yet.';

export const createBrowserSigstoreReport = (
  statement: JsonLPayload,
): SigstoreReport => {
  const logIndex = statement.tlogEntries?.[0]?.logIndex;
  const transparencyReason = logIndex
    ? 'Transparency log entry is linked but not cryptographically verified in the browser yet.'
    : 'No transparency log entry is available in the provenance bundle.';

  const signature = createCheckReport('DSSE signature', 'unavailable', [
    BROWSER_VERIFIER_PENDING,
  ]);
  const certificate = createCheckReport('Fulcio certificate', 'unavailable', [
    BROWSER_VERIFIER_PENDING,
  ]);
  const transparencyLog = createCheckReport(
    'Rekor transparency log',
    'unavailable',
    [transparencyReason],
    { logIndex },
  );
  const trustedRoot = createCheckReport('Sigstore trusted root', 'unavailable', [
    'Pinned trusted root validation has not been wired into the browser verifier yet.',
  ]);

  return {
    valid: false,
    status: 'unavailable',
    signature,
    certificate,
    transparencyLog,
    trustedRoot,
    logIndex,
    failureReasons: [
      ...signature.failureReasons,
      ...certificate.failureReasons,
      ...transparencyLog.failureReasons,
      ...trustedRoot.failureReasons,
    ],
  };
};
