import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  Hash,
  User,
  Info,
  Image as ImageIcon,
  Link as LinkIcon,
  Tag,
  ExternalLink,
} from 'lucide-react';
import {
  getSiteResources,
  NETWORK,
  SiteResourceData,
} from '../utils/getSiteResources';

export const Site = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const prefix = searchParams.get('q') || '';

  const [domain, setDomain] = useState(`${prefix}.wal.app`);
  const [loading, setLoading] = useState(true);
  const [provenance, setProvenance] = useState<string>('');
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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(siteResources.resources.length / itemsPerPage);
  const paginatedResources = siteResources.resources.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const getVerificationStatus = (res: {
    path: string;
    blobHash: string;
  }): 'Verified' | 'Not verified' | 'Unknown' => {
    if (!provenance) return 'Unknown';
    /*
    const match = provenance.subjects?.some(
      (s: any) => s.name === res.path && s.digest.sha256 === res.blobHash,
    );

    return match ? 'Verified' : 'Not verified';
    */
    return 'Verified';
  };

  useEffect(() => {
    if (!prefix) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      const siteData = await getSiteResources(prefix);
      setSiteResources(siteData);

      try {
        setLoading(true);

        const jsonlUrl = `https://${prefix}.wal.app/.well-known/walrus-sites.intoto.jsonl`;
        const response = await fetch(jsonlUrl);
        if (response.ok) {
          // const jsonlText = await response.text();
          // setProvenance(parseJsonl(jsonlText)); // implement
        } else {
          setProvenance('');
        }
      } catch {
        setProvenance('');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [prefix]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = `https://${domain}`;
    const match = url.match(/^https:\/\/([a-z0-9-]+)\.wal\.app$/i);
    if (!match) {
      /*
      setError(
        'Only `.wal.app` domains are supported. Please enter a valid address.',
      );
      */
      // TODO: Modal
      return;
    }
    navigate(`/site?q=${match[1]}`);
  };

  return (
    <div className="relative min-h-screen text-white overflow-hidden bg-[#0b0d14]">
      <form
        onSubmit={handleSubmit}
        className="fixed top-0 left-0 w-full bg-[#111827] z-20 border-b border-gray-700"
      >
        <div className="max-w-4xl mx-auto flex items-center px-4 py-3">
          <span className="text-white mr-2 select-none">https://</span>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="notary.wal.app"
            className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none border-b border-gray-600 py-1"
          />
          <button
            type="submit"
            className="ml-2 bg-green-400 hover:bg-green-500 text-black rounded-full w-6 h-6 flex items-center justify-center"
            aria-label="Verify"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      </form>

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
                  Verification Result for{' '}
                  <span className="text-green-400">{prefix}.wal.app</span>
                </h1>

                <div className="p-6 rounded-lg mb-8 space-y-2 text-sm bg-white/3 backdrop-blur-md border border-white/5">
                  {[
                    [
                      <Hash className="w-4 h-4 text-gray-400" />,
                      'Site Object ID',
                      siteResources.id,
                      `https://suiscan.xyz/${NETWORK}/object/${siteResources.id}`,
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

                <div className="p-6 rounded-lg mb-8 space-y-2 text-sm bg-white/3 backdrop-blur-md border border-white/5">
                  <div className="flex items-center gap-2 mb-4 text-lg font-semibold">
                    {provenance ? (
                      <>
                        <Check className="text-green-400 w-5 h-5" />
                        <span className="text-green-400">
                          Provenance file found
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="text-yellow-400 w-5 h-5" />
                        <span className="text-yellow-400">
                          No provenance file
                        </span>
                      </>
                    )}
                  </div>

                  <table className="w-full text-sm table-auto border-collapse">
                    <thead className="text-gray-400 border-b border-gray-700">
                      <tr>
                        <th className="text-left py-2">Filename</th>
                        <th className="text-left py-2">Blob ID</th>
                        <th className="text-left py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedResources.map((res) => {
                        const status = getVerificationStatus(res);
                        return (
                          <tr key={res.id} className="border-b border-gray-800">
                            <td
                              className="py-2 max-w-[230px] whitespace-nowrap overflow-hidden text-ellipsis"
                              title={res.path}
                            >
                              {res.path}
                            </td>

                            <td className="py-2 px-4 text-gray-400 max-w-[310px] whitespace-nowrap overflow-hidden text-ellipsis font-mono">
                              <div className="flex items-center gap-1">
                                <a
                                  href={`https://walruscan.com/${NETWORK}/blob/${res.blobId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="hover:underline truncate"
                                >
                                  {res.blobId}
                                </a>
                                <a
                                  href={`https://walruscan.com/${NETWORK}/blob/${res.blobId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Open blob"
                                  className="text-blue-300"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            </td>
                            <td className="py-2">
                              {status === 'Verified' && (
                                <span className="text-green-400">{status}</span>
                              )}
                              {status === 'Not verified' && (
                                <span className="text-yellow-400">
                                  {status}
                                </span>
                              )}
                              {status === 'Unknown' && (
                                <span className="text-gray-500 italic">
                                  {status}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {Array.from({
                        length: itemsPerPage - paginatedResources.length,
                      }).map((_, idx) => (
                        <tr
                          key={`empty-${idx}`}
                          className="border-b border-gray-800 opacity-20"
                        >
                          <td className="py-2">&nbsp;</td>
                          <td className="py-2 px-4">&nbsp;</td>
                          <td className="py-2">&nbsp;</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-4 text-sm">
                      <button
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(prev - 1, 1))
                        }
                        className="px-2 py-1 w-16 text-center rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30"
                        disabled={currentPage === 1}
                      >
                        Prev
                      </button>
                      <span className="text-gray-400 w-32 text-center">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(prev + 1, totalPages),
                          )
                        }
                        className="px-2 py-1 w-16 text-center rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30"
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
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

      <img
        src="/globe_big.png"
        alt="Globe"
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[1200px] z-0 pointer-events-none"
        loading="lazy"
      />
    </div>
  );
};
