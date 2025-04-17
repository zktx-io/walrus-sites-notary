import { AlertTriangle, ShieldCheck } from 'lucide-react';

import { JsonLPayload } from '../utils/parseJsonl';

export const ProvenanceCard = ({
  provenance,
}: {
  provenance?: JsonLPayload;
}) => {
  if (!provenance) {
    return (
      <div className="p-6 rounded-lg mb-8 text-sm bg-white/3 backdrop-blur-md border border-white/5">
        <div className="flex items-center gap-2 text-yellow-400 font-medium">
          <AlertTriangle className="w-5 h-5" />
          Provenance information unavailable
        </div>
      </div>
    );
  }

  const uri = provenance.predicate?.invocation?.configSource?.uri;
  const commit = provenance.predicate?.invocation?.configSource?.digest?.sha1;
  const file = provenance.predicate?.invocation?.configSource?.entryPoint;
  const logIndex = provenance.tlogEntries?.[0]?.logIndex;
  const runId = provenance.predicate?.invocation?.environment?.github_run_id;
  const runAttempt =
    provenance.predicate?.invocation?.environment?.github_run_attempt;

  return (
    <div className="p-6 rounded-lg mb-8 text-sm bg-white/3 backdrop-blur-md border border-white/5">
      <div className="flex items-center gap-2 text-green-400 font-medium mb-2">
        <ShieldCheck className="w-5 h-5" />
        Provenance verified via GitHub Actions
      </div>
      <ul className="space-y-1">
        <li className="flex items-start gap-2">
          <div className="w-30 shrink-0 text-gray-400">Source Commit</div>
          <div className="text-gray-500">:</div>
          <a
            className="text-blue-300 underline break-all truncate"
            href={uri?.split('@')[0].replace('git+', '') + `/tree/${commit}`}
            target="_blank"
            rel="noreferrer"
            title={`${uri?.split('@')[0].replace('git+', '')}/tree/${commit}`}
          >
            {uri?.split('@')[0].replace('git+', '')}/tree/{commit}
          </a>
        </li>
        <li className="flex items-start gap-2">
          <div className="w-30 shrink-0 text-gray-400">Build File</div>
          <div className="text-gray-500">:</div>
          {runId ? (
            <a
              className="text-blue-300 underline break-all truncate"
              href={
                uri?.split('@')[0].replace('git+', '') +
                `/actions/runs/${runId}/workflow`
              }
              target="_blank"
              rel="noreferrer"
              title={file}
            >
              {file}
            </a>
          ) : (
            <span>-</span>
          )}
        </li>
        <li className="flex items-start gap-2">
          <div className="w-30 shrink-0 text-gray-400">Build Summary</div>
          <div className="text-gray-500">:</div>
          {runId ? (
            <a
              className="text-blue-300 underline break-all truncate"
              href={
                uri?.split('@')[0].replace('git+', '') +
                `/actions/runs/${runId}/attempts/${runAttempt}`
              }
              target="_blank"
              rel="noreferrer"
              title="View summary"
            >
              {`/actions/runs/${runId}/attempts/${runAttempt}`}
            </a>
          ) : (
            <span>-</span>
          )}
        </li>
        <li className="flex items-start gap-2">
          <div className="w-30 shrink-0 text-gray-400">Public Ledger</div>
          <div className="text-gray-500">:</div>
          {logIndex ? (
            <a
              className="text-blue-300 underline break-all truncate"
              href={`https://search.sigstore.dev/?logIndex=${logIndex}`}
              target="_blank"
              rel="noreferrer"
              title="Public Ledger"
            >
              View entry on Sigstore’s transparency log
            </a>
          ) : (
            <span>-</span>
          )}
        </li>
      </ul>
    </div>
  );
};
