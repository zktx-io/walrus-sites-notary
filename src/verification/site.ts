import { getSiteResources, SiteResourceData } from '../utils/getSiteResources';
import { parseJsonlBundle } from '../utils/parseJsonl';
import { readResource } from '../utils/readBlob';

import { verifySiteArtifacts } from './artifacts';
import { createBrowserSigstoreReport } from './browserSigstore';
import { verifyStatementIdentityPolicy } from './identityPolicy';
import {
  composeVerificationReport,
  createMissingProvenanceReport,
} from './report';
import { VerificationReport } from './types';

export const verifySiteInBrowser = async (
  query: string,
): Promise<{
  siteResources: SiteResourceData;
  report: VerificationReport;
}> => {
  const siteResources = await getSiteResources(query);
  const jsonl = siteResources.resources.find(
    (res) => res.path === '/.well-known/walrus-sites.intoto.jsonl',
  );

  if (!jsonl) {
    return {
      siteResources,
      report: createMissingProvenanceReport('site'),
    };
  }

  const blobBytes = await readResource(jsonl);
  const provenance = parseJsonlBundle(new TextDecoder().decode(blobBytes));
  const statement = provenance.statement;
  const sigstore = createBrowserSigstoreReport(statement);
  const identity = verifyStatementIdentityPolicy({
    statement,
    expectedRepository: siteResources.projectUrl,
  });
  const artifact = verifySiteArtifacts(statement, siteResources.resources);

  return {
    siteResources,
    report: composeVerificationReport({
      provenance: statement,
      sigstore,
      identity,
      artifact,
    }),
  };
};
