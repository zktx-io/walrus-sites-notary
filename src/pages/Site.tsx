import {
  Hash,
  User,
  Info,
  Image as ImageIcon,
  Link as LinkIcon,
  Tag,
  ExternalLink,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { BackgroundFx } from '../components/BackgroundFx';
import { Navbar } from '../components/Navbar';
import { ProvenanceCard } from '../components/ProvenanceCard';
import { ResourceTable } from '../components/ResourceTable';
import { getSiteResources, SiteResourceData } from '../utils/getSiteResources';
import { loadSiteConfig } from '../utils/loadSiteConfig';
import { JsonLPayload, parseJsonl } from '../utils/parseJsonl';
import { readBlob } from '../utils/readBlob';
import { truncateMiddle } from '../utils/truncateMiddle';

export const Site = () => {
  const [searchParams] = useSearchParams();
  const prefix = searchParams.get('q') || '';

  const [network, setNetwork] = useState('testnet');
  const [loading, setLoading] = useState(true);
  const [provenance, setProvenance] = useState<JsonLPayload | undefined>(
    undefined,
  );
  const [siteResources, setSiteResources] = useState<SiteResourceData>({
    id: '',
    creator: '',
    description: '',
    imageUrl: '',
    link: '',
    name: '',
    projectUrl: '',
    resources: [],
  });

  useEffect(() => {
    setLoading(true);
    setProvenance(undefined);
    setSiteResources({
      id: '',
      creator: '',
      description: '',
      imageUrl: '',
      link: '',
      name: '',
      projectUrl: '',
      resources: [],
    });

    if (!prefix) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const siteData = await getSiteResources(prefix);
        setSiteResources(siteData);

        const jsonl = siteData.resources.find(
          (res) => res.path === '/.well-known/walrus-sites.intoto.jsonl',
        );
        if (jsonl) {
          const blobBytes = await readBlob(jsonl.blobId, jsonl.range);
          setProvenance(parseJsonl(new TextDecoder().decode(blobBytes)));
        }
      } catch {
        setProvenance(undefined);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [prefix]);

  useEffect(() => {
    loadSiteConfig().then((config) => {
      if (config) {
        setNetwork(config.network);
      }
    });
  }, []);

  return (
    <div className="relative min-h-screen text-white overflow-hidden bg-[#0b0d14]">
      <BackgroundFx />
      <Navbar showInput={true} />

      {prefix ? (
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
                    {truncateMiddle(prefix, 20)}.wal.app
                  </div>
                </h1>

                <ProvenanceCard provenance={provenance} />

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
                          <span className="truncate" title={String(value)}>
                            <code>{value || '-'}</code>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <ResourceTable
                  provenance={provenance}
                  resources={siteResources.resources}
                />
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
