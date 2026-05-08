import { fromBase64 } from '@mysten/sui/utils';

import { getMvrData, MvrData } from '../utils/getMvrData';
import { parseJsonlBundle } from '../utils/parseJsonl';

import { createMvrArtifactReport } from './artifacts';
import { createBrowserSigstoreReport } from './browserSigstore';
import { verifyStatementIdentityPolicy } from './identityPolicy';
import {
  composeVerificationReport,
  createMissingProvenanceReport,
} from './report';
import { VerificationReport } from './types';

export const verifyMvrInBrowser = async (
  query: string,
): Promise<{
  mvr: MvrData;
  packageAddress: string;
  params?: {
    [pkg: string]: { name: string; params: { name: string; type: string }[] }[];
  };
  digest?: string;
  report: VerificationReport;
}> => {
  const data = await getMvrData(query);

  if (!data.provenance || !data.digest) {
    return {
      ...data,
      report: createMissingProvenanceReport(
        'mvr',
        data.provenance
          ? 'MVR deployment digest is missing.'
          : 'MVR provenance bundle is missing.',
      ),
    };
  }

  const provenance = parseJsonlBundle(
    new TextDecoder().decode(fromBase64(data.provenance)),
  );
  const statement = provenance.statement;
  const sigstore = createBrowserSigstoreReport(statement);
  const identity = verifyStatementIdentityPolicy({
    statement,
    expectedRepository: data.mvr.git_info?.repository_url,
  });
  const artifact = await createMvrArtifactReport({
    packageAddress: data.packageAddress,
    digest: data.digest,
    statement,
  });

  return {
    ...data,
    report: composeVerificationReport({
      provenance: statement,
      sigstore,
      identity,
      artifact,
    }),
  };
};
