import { ExternalLink, Folder, GitBranch, Github } from 'lucide-react';

import { MvrData } from '../utils/getMvrData';

export const MvrGitInfo = ({ mvrData }: { mvrData: MvrData }) => {
  return (
    <div className="p-6 rounded-lg mb-8 space-y-2 text-sm bg-white/3 backdrop-blur-md border border-white/5">
      {[
        [
          <Github className="w-4 h-4 text-gray-400" />,
          'Github',
          mvrData.git_info?.repository_url,
          mvrData.git_info?.repository_url,
        ],
        [
          <Folder className="w-4 h-4 text-gray-400" />,
          'Path',
          mvrData.git_info?.path,
          mvrData.git_info?.repository_url &&
          mvrData.git_info?.tag &&
          mvrData.git_info?.path
            ? `${mvrData.git_info?.repository_url}/tree/${mvrData.git_info?.tag}/${mvrData.git_info?.path}`
            : undefined,
        ],
        [
          <GitBranch className="w-4 h-4 text-gray-400" />,
          'Tag',
          mvrData.git_info?.tag,
          mvrData.git_info?.repository_url && mvrData.git_info?.tag
            ? `${mvrData.git_info?.repository_url}/tree/${mvrData.git_info?.tag}`
            : undefined,
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
  );
};
