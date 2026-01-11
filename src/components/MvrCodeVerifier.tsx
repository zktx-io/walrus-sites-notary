import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Github,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { MvrData } from '../utils/getMvrData';
import { getPackageCreationTransaction } from '../utils/getPackageCreationTransaction';
import {
  verifySourceCode,
  VerificationResult,
} from '../utils/verifySourceCode';

type AnsiColorMap = Record<number, string>;
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;
const ANSI_COLORS: AnsiColorMap = {
  30: '#e2e8f0',
  31: '#f87171',
  32: '#4ade80',
  33: '#fbbf24',
  34: '#60a5fa',
  35: '#c084fc',
  36: '#2dd4bf',
  37: '#cbd5f5',
  90: '#94a3b8',
  91: '#fca5a5',
  92: '#86efac',
  93: '#fde047',
  94: '#93c5fd',
  95: '#e9d5ff',
  96: '#5eead4',
  97: '#f8fafc',
};

const GITHUB_TOKEN_STORAGE_KEY = 'walrus-notary-github-token';
const GITHUB_TOKEN_CREATE_URL =
  'https://github.com/settings/tokens/new?scopes=repo&description=Walrus%20Notary';

function renderAnsiToReact(
  text: string,
  colorMap: AnsiColorMap,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let currentColor: string | null = null;
  let isBold = false;
  let lastIndex = 0;
  let key = 0;

  const flushText = (chunk: string) => {
    if (!chunk) return;
    const style: React.CSSProperties = {};
    if (currentColor) style.color = currentColor;
    if (isBold) style.fontWeight = 600;
    const parts = chunk.split('\n');
    parts.forEach((part, index) => {
      if (part) {
        nodes.push(
          <span key={`ansi-${key++}`} style={style}>
            {part}
          </span>,
        );
      }
      if (index < parts.length - 1) {
        nodes.push(<br key={`ansi-br-${key++}`} />);
      }
    });
  };

  const matches = Array.from(text.matchAll(ANSI_REGEX));
  for (const match of matches) {
    const idx = match.index ?? 0;
    flushText(text.slice(lastIndex, idx));
    const codeStr = match[0].slice(2, -1);
    const codes = codeStr ? codeStr.split(';').map(Number) : [0];
    for (const code of codes) {
      if (code === 0) {
        currentColor = null;
        isBold = false;
      } else if (code === 1) {
        isBold = true;
      } else if (code === 22) {
        isBold = false;
      } else if (code === 39) {
        currentColor = null;
      } else if (colorMap[code]) {
        currentColor = colorMap[code];
      }
    }
    lastIndex = idx + match[0].length;
  }

  flushText(text.slice(lastIndex));
  return nodes;
}

interface MvrCodeVerifierProps {
  mvrData: MvrData;
  packageAddress: string;
  digest?: string;
}

export const MvrCodeVerifier = ({
  mvrData,
  packageAddress,
  digest,
}: MvrCodeVerifierProps) => {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [githubToken, setGithubToken] = useState('');
  const [tokenVisible, setTokenVisible] = useState(false);
  const [authExpanded, setAuthExpanded] = useState(false);
  const [manualGitInfo, setManualGitInfo] = useState({
    repository: mvrData.git_info?.repository_url || '',
    tag: mvrData.git_info?.tag || '',
    path: mvrData.git_info?.path || '',
  });
  const [resolvedDigest, setResolvedDigest] = useState<string | undefined>(
    digest,
  );

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedToken = window.localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY);
    if (storedToken) {
      setGithubToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (githubToken) {
      window.localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, githubToken);
    } else {
      window.localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
    }
  }, [githubToken]);

  const openGithubTokenPage = () => {
    if (typeof window === 'undefined') {
      return;
    }
    const popup = window.open(
      GITHUB_TOKEN_CREATE_URL,
      '_blank',
      'noopener,noreferrer',
    );
    if (popup) {
      popup.opener = null;
    }
  };

  useEffect(() => {
    setManualGitInfo({
      repository: mvrData.git_info?.repository_url || '',
      tag: mvrData.git_info?.tag || '',
      path: mvrData.git_info?.path || '',
    });
  }, [
    mvrData.git_info?.path,
    mvrData.git_info?.repository_url,
    mvrData.git_info?.tag,
  ]);

  useEffect(() => {
    setResolvedDigest(digest);
  }, [digest]);

  const hasGitInfo = Boolean(
    (manualGitInfo.repository.trim() || mvrData.git_info?.repository_url) &&
      (manualGitInfo.tag.trim() || mvrData.git_info?.tag) &&
      (manualGitInfo.path.trim() || mvrData.git_info?.path),
  );

  const canVerify = hasGitInfo;

  const handleVerify = async () => {
    const repositoryUrl =
      manualGitInfo.repository.trim() || mvrData.git_info?.repository_url;
    const tag = manualGitInfo.tag.trim() || mvrData.git_info?.tag;
    const path = manualGitInfo.path.trim() || mvrData.git_info?.path || '';

    if (!repositoryUrl || !tag || !path) {
      setResult({
        success: false,
        message: 'Missing git information or transaction digest',
        error: 'Incomplete data',
      });
      return;
    }

    setVerifying(true);
    setResult(null);
    setLogs([]);
    setProgress('Starting verification...');

    try {
      addLog('🚀 Starting source code verification');
      addLog(`📦 Repository: ${repositoryUrl}`);
      addLog(`🏷️  Tag: ${tag}`);
      addLog(`📁 Path: ${path}`);

      let txDigest = resolvedDigest;

      if (!txDigest) {
        if (!packageAddress) {
          throw new Error('Package address is required to resolve transaction');
        }
        setProgress('Resolving deployment transaction...');
        addLog(
          '🔍 Resolving deployment transaction from package object to fetch digest',
        );
        txDigest = await getPackageCreationTransaction(packageAddress);
        setResolvedDigest(txDigest);
        addLog(`📜 Resolved transaction: ${txDigest}`);
      }

      addLog(`ℹ️ Credential digest: ${digest ?? 'not provided'}`);
      addLog(`ℹ️ Resolved digest: ${txDigest}`);

      if (digest) {
        if (txDigest !== digest) {
          addLog(
            `⚠️ Credential digest (${digest}) differs from resolved transaction (${txDigest})`,
          );
        } else {
          addLog(
            '✅ Credential digest matches resolved deployment transaction',
          );
        }
      } else {
        addLog(
          'ℹ️ No credential digest available, using resolved deployment transaction',
        );
      }

      setProgress('Fetching source code from GitHub...');
      addLog('⬇️  Fetching source code from GitHub...');

      if (githubToken) {
        addLog('🔐 GitHub token will be used for API calls');
      }

      const verificationResult = await verifySourceCode(
        repositoryUrl,
        tag,
        path,
        packageAddress,
        txDigest,
        'mainnet',
        addLog,
        githubToken || undefined,
      );

      if (verificationResult.success) {
        addLog('✅ Verification completed successfully!');
      } else {
        addLog('❌ Verification failed');
      }

      setResult(verificationResult);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addLog(`❌ Error: ${errorMsg}`);
      setResult({
        success: false,
        message: 'Verification error',
        error: errorMsg,
      });
    } finally {
      setVerifying(false);
      setProgress('');
    }
  };

  return (
    <div className="p-6 rounded-lg mb-8 bg-white/3 backdrop-blur-md border border-white/5">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-2">
          Source Code Verification
        </h3>
        <p className="text-gray-400 text-sm">
          Verify that the deployed bytecode matches the source code from GitHub
          by rebuilding the package locally.
        </p>
      </div>

      <div className="bg-slate-900/40 border border-white/10 rounded-lg p-4 mb-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Github className="w-4 h-4" />
          <span>GitHub source information</span>
        </div>
        <div className="grid gap-3 text-xs text-gray-300 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            Repository URL
            <input
              type="text"
              value={manualGitInfo.repository}
              className="w-full px-3 py-2 rounded border border-white/10 bg-slate-950/40 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="https://github.com/org/repo"
              readOnly
            />
          </label>
          <label className="flex flex-col gap-1">
            Tag / Branch
            <input
              type="text"
              value={manualGitInfo.tag}
              className="w-full px-3 py-2 rounded border border-white/10 bg-slate-950/40 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="main"
              readOnly
            />
          </label>
          <label className="flex flex-col gap-1">
            Path
            <input
              type="text"
              value={manualGitInfo.path}
              className="w-full px-3 py-2 rounded border border-white/10 bg-slate-950/40 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="packages/my-package"
              readOnly
            />
          </label>
        </div>
        <p className="text-xs text-gray-400">
          This information is populated from the MVR record. Update it to verify
          manually when credentials are missing.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setAuthExpanded((prev) => !prev)}
            className="flex w-full items-center justify-between rounded border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 hover:border-blue-400 transition"
            aria-expanded={authExpanded}
          >
            <span>GitHub authentication</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                authExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
          <div
            className={`mt-3 overflow-hidden transition-[max-height] duration-200 ${
              authExpanded ? 'max-h-[480px]' : 'max-h-0'
            }`}
          >
            <div className="rounded border border-white/10 bg-slate-950/40 p-3">
              <label className="flex flex-col gap-2 text-xs text-gray-300">
                <span className="text-gray-400">Personal access token (optional)</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type={tokenVisible ? 'text' : 'password'}
                    value={githubToken}
                    onChange={(event) => setGithubToken(event.target.value)}
                    className="flex-1 min-w-[200px] px-3 py-2 text-xs rounded border border-white/10 bg-slate-950/40 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
                    placeholder="ghp_123yourtokenhere"
                  />
                  <button
                    type="button"
                    onClick={() => setTokenVisible((prev) => !prev)}
                    className="px-3 py-2 text-xs rounded border border-white/10 bg-white/10 text-white hover:border-blue-500"
                  >
                    {tokenVisible ? 'Hide' : 'Show'}
                  </button>
                  {githubToken && (
                    <button
                      type="button"
                      onClick={() => setGithubToken('')}
                      className="px-3 py-2 text-xs rounded border border-red-500/60 bg-red-500/10 text-red-200 hover:border-red-400"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-[0.65rem] text-gray-400">
                  <span>Stored locally in this browser only.</span>
                  <button
                    type="button"
                    onClick={openGithubTokenPage}
                    className="px-2 py-1 rounded border border-white/10 text-white text-[0.65rem] hover:border-blue-500"
                  >
                    Create token on GitHub
                  </button>
                </div>
                <p className="text-[0.65rem] text-gray-500">
                  Use a token with minimal repo read access to avoid GitHub API rate
                  limits when resolving Move packages.
                </p>
              </label>
            </div>
          </div>
        </div>
      </div>
      {!canVerify ? (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-yellow-200 font-semibold">
                Cannot verify source code
              </p>
              <p className="text-yellow-300/80 text-sm mt-1">
                {!hasGitInfo
                  ? 'GitHub repository, tag, and path are required to verify.'
                  : 'No transaction digest available'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
          >
            {verifying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <div className="flex flex-col items-center">
                  <span>Verifying...</span>
                  {progress && (
                    <span className="text-xs text-gray-300 mt-1">
                      {progress}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <span>Verify Source Code</span>
            )}
          </button>

          {logs.length > 0 && (
            <div className="mt-4 bg-slate-950/80 rounded-lg p-4 border border-slate-700 font-mono text-xs max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 font-semibold">
                  Verification Logs
                </span>
                <span className="text-slate-500">{logs.length} entries</span>
              </div>
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className="text-slate-300 hover:bg-slate-800/50 px-2 py-1 rounded"
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div className="mt-6">
              <div
                className={`rounded-lg p-4 border ${
                  result.success
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p
                      className={`font-semibold ${
                        result.success ? 'text-green-200' : 'text-red-200'
                      }`}
                    >
                      {result.message}
                    </p>
                    {result.error && (
                      <div className="mt-4">
                        <div className="bg-slate-950/80 rounded-lg p-4 border border-red-500/30 font-mono text-xs overflow-x-auto">
                          <div className="text-red-300 font-semibold mb-2">
                            Build Error:
                          </div>
                          <div className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {renderAnsiToReact(result.error, ANSI_COLORS)}
                          </div>
                        </div>
                        {result.error.includes('403') && (
                          <p className="text-yellow-300/80 text-xs mt-2">
                            GitHub API rate limit may have been exceeded. Please
                            try again later or authenticate with a GitHub token.
                          </p>
                        )}
                        {result.error.includes('404') && (
                          <p className="text-yellow-300/80 text-xs mt-2">
                            The repository, tag, or path could not be found.
                            Please verify the git information is correct.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {result.details && (
                <div className="mt-4 space-y-3">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <h4 className="text-white font-semibold mb-3">
                      Verification Details
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Total Modules:</span>
                        <span className="text-white font-mono">
                          {result.details.totalModules}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Matching Modules:</span>
                        <span
                          className={`font-mono font-semibold ${
                            result.details.matchingModules ===
                            result.details.totalModules
                              ? 'text-green-400'
                              : 'text-yellow-400'
                          }`}
                        >
                          {result.details.matchingModules} /{' '}
                          {result.details.totalModules}
                        </span>
                      </div>
                      {result.details.builtDigest && (
                        <div className="flex flex-col gap-1 pt-2">
                          <span className="text-gray-400">Build Digest:</span>
                          <span className="text-white font-mono text-xs break-all bg-slate-900/50 p-2 rounded">
                            {result.details.builtDigest}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {result.details.builtModules &&
                    result.details.deployedModules && (
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <h4 className="text-white font-semibold mb-3">
                          Module Comparison
                        </h4>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {result.details.builtModules.map((module, index) => {
                            const matches =
                              module ===
                              result.details!.deployedModules![index];
                            return (
                              <div
                                key={index}
                                className={`p-2 rounded text-xs font-mono ${
                                  matches
                                    ? 'bg-green-500/10 border border-green-500/30'
                                    : 'bg-red-500/10 border border-red-500/30'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  {matches ? (
                                    <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                                  )}
                                  <span
                                    className={
                                      matches
                                        ? 'text-green-300'
                                        : 'text-red-300'
                                    }
                                  >
                                    Module {index + 1}
                                  </span>
                                </div>
                                <div className="pl-5 space-y-1">
                                  <div className="break-all text-gray-400">
                                    Built: {module.substring(0, 80)}...
                                  </div>
                                  {!matches && (
                                    <div className="break-all text-gray-400">
                                      Deployed:{' '}
                                      {result.details!.deployedModules![
                                        index
                                      ].substring(0, 80)}
                                      ...
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
