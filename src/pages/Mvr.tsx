import { BookOpen, GitFork, ShieldCheck, TerminalSquare } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { BackgroundFx } from '../components/BackgroundFx';
import { MoveCall } from '../components/MoveCall';
import { MvrCodeVerifier } from '../components/MvrCodeVerifier';
import { MvrGitInfo } from '../components/MvrGitInfo';
import { MvrMetaData } from '../components/MvrMetaData';
import { MvrReadMe } from '../components/MvrReadMe';
import { Navbar } from '../components/Navbar';
import { ProvenanceCard } from '../components/ProvenanceCard';
import { Tabs } from '../components/Tabs';
import { MvrData } from '../utils/getMvrData';
import { truncateMiddle } from '../utils/truncateMiddle';
import { verifyMvrInBrowser } from '../verification/mvr';
import { VerificationReport } from '../verification/types';

export const Mvr = () => {
  const location = useLocation();
  const query = location.pathname.replace(/^\/mvr\//, '');

  const [loading, setLoading] = useState(true);
  const [verificationReport, setVerificationReport] = useState<
    VerificationReport | undefined
  >(undefined);
  const [mvrData, setMvrData] = useState<MvrData>({});
  const [params, setParams] = useState<{
    [pkg: string]: { name: string; params: { name: string; type: string }[] }[];
  }>({});
  const [pkgAddress, setPkgAddress] = useState<string>('');
  const [digest, setDigest] = useState<string | undefined>(undefined);
  const artifactMatched = Boolean(verificationReport?.artifact.valid);
  const hasMoveCallAccess = Object.keys(params).length > 0;
  const hasVerifierInfo = Boolean(
    mvrData.git_info?.repository_url &&
      mvrData.git_info?.tag &&
      mvrData.git_info?.path,
  );

  const verifierLabel = useMemo(() => {
    const icon = artifactMatched ? (
      <ShieldCheck className="w-4 h-4 text-current transition-colors duration-150 group-hover:text-black dark:group-hover:text-white" />
    ) : (
      <GitFork className="w-4 h-4 text-current transition-colors duration-150 group-hover:text-black dark:group-hover:text-white" />
    );

    return (
      <span className="flex items-center gap-1">
        {icon}
        Verifier
      </span>
    );
  }, [artifactMatched]);

  const tabs = useMemo(() => {
    const readmeLabel = (
      <span className="flex items-center gap-1">
        <BookOpen className="w-4 h-4" />
        ReadMe
      </span>
    );

    const moveCallLabel = (
      <span className="flex items-center gap-1">
        <TerminalSquare className="w-4 h-4" />
        MoveCall
      </span>
    );

    return [
      {
        label: readmeLabel,
        value: 'readme',
        content: <MvrReadMe mvrData={mvrData} />,
      },
      ...(hasVerifierInfo
        ? [
            {
              label: verifierLabel,
              value: 'verifier',
              content: (
                <MvrCodeVerifier
                  mvrData={mvrData}
                  packageAddress={pkgAddress}
                  digest={digest}
                />
              ),
            },
          ]
        : []),
      ...(hasMoveCallAccess
        ? [
            {
              label: moveCallLabel,
              value: 'movecall',
              content: <MoveCall address={pkgAddress} params={params} />,
            },
          ]
        : []),
    ];
  }, [
    digest,
    hasMoveCallAccess,
    hasVerifierInfo,
    mvrData,
    params,
    pkgAddress,
    verifierLabel,
  ]);

  useEffect(() => {
    setLoading(true);
    setVerificationReport(undefined);
    setMvrData({});
    setParams({});
    setPkgAddress('');
    setDigest(undefined);

    if (!query) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const result = await verifyMvrInBrowser(query);
        setMvrData(result.mvr);
        setParams(result.params || {});
        setPkgAddress(result.packageAddress);
        setDigest(result.digest);
        setVerificationReport(result.report);
      } catch {
        setVerificationReport(undefined);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [query]);

  return (
    <div className="relative min-h-screen text-white overflow-hidden bg-[#0b0d14]">
      <BackgroundFx />
      <Navbar showInput={true} />

      {query ? (
        <div className="flex justify-center items-center px-4 pt-[88px] pb-12">
          <div className="z-10 max-w-4xl w-full">
            {loading ? (
              <div className="min-h-[calc(100vh-88px)] flex items-center justify-center">
                <p>Loading...</p>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold mb-4 text-center">
                  <div>Verification Result for</div>
                  <div className="text-green-400">
                    {truncateMiddle(query, 20)}
                  </div>
                </h1>

                <ProvenanceCard report={verificationReport} />
                <MvrGitInfo mvrData={mvrData} />
                <MvrMetaData mvrData={mvrData} />
                <Tabs tabs={tabs} />
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-screen flex items-center justify-center bg-[#0b0d14] text-white px-4">
          <p className="text-red-500 text-lg font-semibold">
            Missing MVR Name.
          </p>
        </div>
      )}
    </div>
  );
};
