import { ExternalLink } from 'lucide-react';
import { useState } from 'react';

import { JsonLPayload } from '../utils/parseJsonl';

export const ResourceTable = ({
  provenance,
  resources,
}: {
  provenance: JsonLPayload | undefined;
  resources: {
    id: string;
    path: string;
    blobId: string;
    blobHash: string;
  }[];
}) => {
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(resources.length / itemsPerPage);
  const paginatedResources = resources.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const getVerificationStatus = (res: {
    path: string;
    blobHash: string;
  }): 'Verified' | 'Not verified' | 'Unknown' | 'Provenance file' => {
    if (!provenance) {
      return 'Unknown';
    }

    if (res.path === '/.well-known/walrus-sites.intoto.jsonl') {
      return 'Provenance file';
    }

    const match = provenance.subject.some(
      (s: { name: string; digest: { sha256: string } }) =>
        (s.name.startsWith('/') ? s.name : `/${s.name}`) === res.path &&
        s.digest.sha256 === res.blobHash,
    );

    return match ? 'Verified' : 'Not verified';
  };

  return (
    <div className="p-6 rounded-lg mb-8 space-y-2 text-sm bg-white/3 backdrop-blur-md border border-white/5">
      <table className="table-fixed w-full text-sm border-collapse">
        <thead className="text-gray-400 border-b border-gray-700">
          <tr>
            <th className="text-left py-2 w-[30%]">Filename</th>
            <th className="text-left py-2 px-4 w-[50%]">Blob ID</th>
            <th className="text-right py-2 w-[20%]">Status</th>
          </tr>
        </thead>
        <tbody>
          {paginatedResources.map((res) => {
            const status = getVerificationStatus(res);
            return (
              <tr key={res.id} className="border-b border-gray-800">
                <td
                  className="py-2 pr-4 text-left text-gray-200 max-w-[250px] overflow-hidden text-ellipsis whitespace-nowrap"
                  title={res.path}
                >
                  {res.path}
                </td>
                <td className="py-2 px-4 text-gray-400 font-mono max-w-[400px] overflow-hidden text-ellipsis whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <a
                      href={`https://walruscan.com/blob/${res.blobId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline overflow-hidden text-ellipsis whitespace-nowrap"
                      title={res.blobId}
                    >
                      {res.blobId}
                    </a>
                    <a
                      href={`https://walruscan.com/blob/${res.blobId}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Open blob"
                      className="text-blue-300 shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </td>
                <td className="py-2 text-right overflow-hidden text-ellipsis whitespace-nowrap">
                  {status === 'Verified' && (
                    <span className="text-green-400">{status}</span>
                  )}
                  {status === 'Not verified' && (
                    <span className="text-yellow-400">{status}</span>
                  )}
                  {status === 'Unknown' && (
                    <span className="text-gray-500 italic">{status}</span>
                  )}
                  {status === 'Provenance file' && (
                    <span className="text-gray-400 italic">{status}</span>
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
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
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
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            className="px-2 py-1 w-16 text-center rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30"
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
