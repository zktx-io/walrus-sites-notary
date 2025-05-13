import {
  BookOpen,
  Contact2,
  ExternalLink,
  Home,
  ImageIcon,
  Text,
} from 'lucide-react';

import { MvrData } from '../utils/getMvrData';

export const MvrMetaData = ({ mvrData }: { mvrData: MvrData }) => {
  return (
    <div className="p-6 rounded-lg mb-8 space-y-2 text-sm bg-white/3 backdrop-blur-md border border-white/5">
      {[
        [
          <Home className="w-4 h-4 text-gray-400" />,
          'Homepage',
          mvrData.metadata?.homepage_url,
          mvrData.metadata?.homepage_url,
        ],
        [
          <BookOpen className="w-4 h-4 text-gray-400" />,
          'Document',
          mvrData.metadata?.documentation_url,
          mvrData.metadata?.documentation_url,
        ],
        [
          <ImageIcon className="w-4 h-4 text-gray-400" />,
          'Icon',
          mvrData.metadata?.icon_url,
          mvrData.metadata?.icon_url,
        ],
        [
          <Contact2 className="w-4 h-4 text-gray-400" />,
          'Contact',
          mvrData.metadata?.contact,
        ],
        [
          <Text className="w-4 h-4 text-gray-400" />,
          'Description',
          mvrData.metadata?.description,
        ],
      ].map(([icon, label, value, link], idx) => {
        const isDescription = label === 'Description';

        return (
          <div key={idx} className="flex items-start">
            <div className="w-30 shrink-0 flex items-center gap-2 text-gray-400 pt-1">
              {icon}
              {label}
            </div>
            <div className="mx-2 text-gray-500">:</div>
            <div className="flex-1 text-white whitespace-pre-wrap">
              {isDescription ? (
                <div>{value || '-'}</div>
              ) : link && typeof link === 'string' ? (
                <div className="flex items-center gap-1 truncate">
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
                </div>
              ) : (
                <code className="text-gray-400">{value || '-'}</code>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
