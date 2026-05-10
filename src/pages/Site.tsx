import { useDAppKit } from '@mysten/dapp-kit-react';
import {
  Hash,
  User,
  Info,
  Image as ImageIcon,
  Link as LinkIcon,
  Tag,
  ExternalLink,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { BackgroundFx } from '../components/BackgroundFx';
import { Navbar } from '../components/Navbar';
import { ProvenanceCard } from '../components/ProvenanceCard';
import { ResourceTable } from '../components/ResourceTable';
import { extendEpoch } from '../utils/extendEpoch';
import { SiteResourceData } from '../utils/getSiteResources';
import { APP_NETWORK } from '../utils/suiClient';
import { truncateMiddle } from '../utils/truncateMiddle';
import { verifySiteInBrowser } from '../verification/site';
import { VerificationReport } from '../verification/types';

export const Site = () => {
  const location = useLocation();
  const query = location.pathname.replace(/^\/site\//, '');

  const dAppKit = useDAppKit();
  const network = APP_NETWORK;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [verificationReport, setVerificationReport] = useState<
    VerificationReport | undefined
  >(undefined);
  const [siteResources, setSiteResources] = useState<SiteResourceData>({
    id: '',
    siteObjOwner: '',
    creator: '',
    description: '',
    imageUrl: '',
    link: '',
    name: '',
    projectUrl: '',
    resources: [],
    epoch: 0,
    blobs: {},
  });

  const fetchData = useCallback(async () => {
    try {
      setLoadError(undefined);
      const { siteResources: siteData, report } =
        await verifySiteInBrowser(query);
      setSiteResources(siteData);
      setVerificationReport(report);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
      setVerificationReport(undefined);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const onExtend = async (opts: {
    sender: string;
    objectIds: string[];
    epochs: number;
  }) => {
    if (!opts?.sender) throw new Error('Missing sender address.');
    if (!Array.isArray(opts.objectIds) || opts.objectIds.length === 0) {
      throw new Error('No blob objects to extend.');
    }
    if (!Number.isInteger(opts.epochs) || opts.epochs <= 0) {
      throw new Error('Epochs must be a positive integer.');
    }

    try {
      setLoading(true);
      const transaction = await extendEpoch(opts);
      await dAppKit.signAndExecuteTransaction({
        transaction,
      });
      await fetchData();
    } catch (e) {
      setLoading(false);
      throw e;
    }
  };

  useEffect(() => {
    setLoading(true);
    setLoadError(undefined);
    setVerificationReport(undefined);
    setSiteResources({
      id: '',
      siteObjOwner: '',
      creator: '',
      description: '',
      imageUrl: '',
      link: '',
      name: '',
      projectUrl: '',
      resources: [],
      epoch: 0,
      blobs: {},
    });

    if (!query) {
      setLoading(false);
      return;
    }

    fetchData();
  }, [query, fetchData]);

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
                    {truncateMiddle(query, 20)}.wal.app
                  </div>
                </h1>

                {loadError ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                    <p className="font-semibold text-red-200">
                      Unable to verify site
                    </p>
                    <p className="mt-1 text-red-100/80">{loadError}</p>
                  </div>
                ) : (
                  <>
                    <ProvenanceCard report={verificationReport} />

                    <div className="p-6 rounded-lg mb-8 space-y-2 text-sm bg-white/3 backdrop-blur-md border border-white/5">
                      {[
                        [
                          <Hash className="w-4 h-4 text-gray-400" />,
                          'Site Object ID',
                          siteResources.id,
                          siteResources.id
                            ? `https://suiscan.xyz/${network}/object/${siteResources.id}`
                            : '',
                        ],
                        [
                          <User className="w-4 h-4 text-gray-400" />,
                          'Creator',
                          siteResources.creator,
                        ],
                        [
                          <Info className="w-4 h-4 text-gray-400" />,
                          'Description',
                          siteResources.description,
                        ],
                        [
                          <ImageIcon className="w-4 h-4 text-gray-400" />,
                          'Image URL',
                          siteResources.imageUrl,
                        ],
                        [
                          <LinkIcon className="w-4 h-4 text-gray-400" />,
                          'Link',
                          siteResources.link,
                          siteResources.link,
                        ],
                        [
                          <Tag className="w-4 h-4 text-gray-400" />,
                          'Name',
                          siteResources.name,
                        ],
                        [
                          <ExternalLink className="w-4 h-4 text-gray-400" />,
                          'Project URL',
                          siteResources.projectUrl,
                          siteResources.projectUrl,
                        ],
                      ].map(([icon, label, value, link], idx) => (
                        <div key={idx} className="flex items-center">
                          <div className="w-30 shrink-0 flex items-center gap-2 text-gray-400">
                            {icon}
                            {label}
                          </div>
                          <div className="mx-2 text-gray-500">:</div>
                          <div className="flex-1 flex items-center gap-1 truncate">
                            {link && typeof link === 'string' ? (
                              <>
                                <a
                                  href={link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="truncate text-blue-300 underline"
                                  title={String(link)}
                                >
                                  {value}
                                </a>
                                <a
                                  href={link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-300"
                                  title="Open link"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </>
                            ) : (
                              <span
                                className="truncate"
                                title={String(value)}
                              >
                                <code>{value || '-'}</code>
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <ResourceTable
                      artifactReport={verificationReport?.artifact}
                      siteObjOwner={siteResources.siteObjOwner}
                      resources={siteResources.resources}
                      epoch={siteResources.epoch}
                      blobs={siteResources.blobs}
                      onExtend={onExtend}
                    />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-screen flex items-center justify-center bg-[#0b0d14] text-white px-4">
          <p className="text-red-500 text-lg font-semibold">
            Missing site prefix.
          </p>
        </div>
      )}
    </div>
  );
};
