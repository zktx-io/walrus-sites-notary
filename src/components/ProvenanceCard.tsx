import { AlertTriangle, CheckCircle2, ExternalLink, XCircle } from 'lucide-react';

import { VerificationReport } from '../verification/types';

const githubRepoUrl = (uri?: string): string | undefined => {
  if (!uri) return undefined;
  const normalized = uri.replace(/^git\+/, '');
  const httpsMatch = normalized.match(/https:\/\/github\.com\/([^/@]+\/[^/@.]+)/i);
  if (httpsMatch?.[1]) {
    return `https://github.com/${httpsMatch[1]}`;
  }

  const sshMatch = normalized.match(/git@github\.com:([^/@]+\/[^/@.]+)/i);
  if (sshMatch?.[1]) {
    return `https://github.com/${sshMatch[1]}`;
  }

  return undefined;
};

export const ProvenanceCard = ({ report }: { report?: VerificationReport }) => {
  if (!report?.provenance) {
    return (
      <div className="p-6 rounded-lg mb-8 text-sm bg-white/3 backdrop-blur-md border border-white/5">
        <div className="flex items-center gap-2 text-yellow-400 font-medium">
          <AlertTriangle className="w-5 h-5" />
          Provenance information unavailable
        </div>
      </div>
    );
  }

  const provenance = report.provenance;
  const uri = provenance.predicate?.invocation?.configSource?.uri;
  const repositoryUrl = githubRepoUrl(uri);
  const commit = provenance.predicate?.invocation?.configSource?.digest?.sha1;
  const file = provenance.predicate?.invocation?.configSource?.entryPoint;
  const logIndex = report.sigstore.logIndex;
  const runId = provenance.predicate?.invocation?.environment?.github_run_id;
  const runAttempt =
    provenance.predicate?.invocation?.environment?.github_run_attempt;
  const provenanceLinked = logIndex != null;
  const blockingFailure =
    report.artifact.status === 'failed' ||
    report.identity.status === 'failed' ||
    report.sigstore.status === 'failed';
  const integrityChecked =
    report.artifact.valid && provenanceLinked && !blockingFailure;
  const headerText = report.verified
    ? 'Fully verified in browser'
    : integrityChecked
      ? 'Integrity checked'
      : 'Unverified';
  const headerClassName = report.verified
    ? 'text-green-400'
    : integrityChecked
      ? 'text-yellow-400'
      : 'text-red-300';
  const HeaderIcon = report.verified
    ? CheckCircle2
    : integrityChecked
      ? AlertTriangle
      : XCircle;

  return (
    <div className="p-6 rounded-lg mb-8 text-sm bg-white/3 backdrop-blur-md border border-white/5">
      <div
        className={`flex items-center gap-2 font-medium mb-4 ${headerClassName}`}
      >
        <HeaderIcon className="w-5 h-5" />
        {headerText}
      </div>

      <ul className="space-y-1 mb-4">
        <li className="flex items-start gap-2">
          <div className="w-36 shrink-0 text-gray-400">
            Artifact integrity
          </div>
          <div className="text-gray-500">:</div>
          <div
            className={
              report.artifact.valid ? 'text-green-400' : 'text-yellow-400'
            }
          >
            {report.artifact.summary}
          </div>
        </li>
      </ul>

      <ul className="space-y-1">
        <li className="flex items-start gap-2">
          <div className="w-36 shrink-0 text-gray-400">Source Commit</div>
          <div className="text-gray-500">:</div>
          {repositoryUrl && commit ? (
            <a
              className="text-blue-300 underline break-all truncate"
              href={`${repositoryUrl}/tree/${commit}`}
              target="_blank"
              rel="noreferrer"
              title={`${repositoryUrl}/tree/${commit}`}
            >
              {repositoryUrl}/tree/{commit}
            </a>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </li>
        <li className="flex items-start gap-2">
          <div className="w-36 shrink-0 text-gray-400">Build File</div>
          <div className="text-gray-500">:</div>
          {repositoryUrl && runId ? (
            <a
              className="text-blue-300 underline break-all truncate"
              href={`${repositoryUrl}/actions/runs/${runId}/workflow`}
              target="_blank"
              rel="noreferrer"
              title={file}
            >
              {file}
            </a>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </li>
        <li className="flex items-start gap-2">
          <div className="w-36 shrink-0 text-gray-400">Build Summary</div>
          <div className="text-gray-500">:</div>
          {repositoryUrl && runId ? (
            <a
              className="text-blue-300 underline break-all truncate"
              href={`${repositoryUrl}/actions/runs/${runId}/attempts/${runAttempt}`}
              target="_blank"
              rel="noreferrer"
              title="View summary"
            >
              {`/actions/runs/${runId}/attempts/${runAttempt}`}
            </a>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </li>
        <li className="flex items-start gap-2">
          <div className="w-36 shrink-0 text-gray-400">Public Ledger</div>
          <div className="text-gray-500">:</div>
          {provenanceLinked ? (
            <a
              className="text-blue-300 underline break-all truncate inline-flex items-center gap-1"
              href={`https://search.sigstore.dev/?logIndex=${logIndex}`}
              target="_blank"
              rel="noreferrer"
              title="Public Ledger"
            >
              View Sigstore entry
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </li>
      </ul>

      {report.visibleFailureReasons.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <div className="text-gray-400 mb-1">Reasons</div>
          <ul className="space-y-1 text-xs text-yellow-200/90">
            {report.visibleFailureReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
