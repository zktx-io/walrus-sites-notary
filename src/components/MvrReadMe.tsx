import { fromBase64 } from '@mysten/sui/utils';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

import { MvrData } from '../utils/getMvrData';

export const MvrReadMe = ({ mvrData }: { mvrData: MvrData }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [readMeContent, setReadMeContent] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    const fetchReadMe = async () => {
      if (
        mvrData.git_info?.repository_url &&
        mvrData.git_info?.path &&
        mvrData.git_info?.tag
      ) {
        try {
          setLoading(true);
          const response = await fetch(
            `${(mvrData.git_info?.repository_url || '').replace('https://github.com/', 'https://api.github.com/repos/')}/contents/${mvrData.git_info?.path}/README.md?ref=${mvrData.git_info?.tag}`
              .replace(/\/\.\//g, '/')
              .replace(/\/{2,}/g, '/')
              .replace('https:/api.', 'https://api.'),
            {
              method: 'GET',
            },
          );
          const data = await response.json();
          if (data && data.content) {
            const decodedContent = new TextDecoder().decode(
              fromBase64(data.content),
            );
            setReadMeContent(decodedContent);
          } else {
            setError(true);
          }
        } catch {
          setError(true);
        } finally {
          setLoading(false);
        }
      } else {
        setError(true);
      }
    };
    fetchReadMe();
  }, [
    mvrData.git_info?.repository_url,
    mvrData.git_info?.path,
    mvrData.git_info?.tag,
  ]);

  return (
    <div className="p-6 rounded-lg mb-8 space-y-2 text-sm bg-white/3 backdrop-blur-md border border-white/5">
      {loading && <p>Loading...</p>}
      {error && (
        <div className="flex items-center gap-2 text-yellow-400 font-medium">
          <AlertTriangle className="w-5 h-5" />
          Failed to load README
        </div>
      )}
      {readMeContent && (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            h1: ({ node, ...props }) => (
              <h1 className="text-2xl font-bold mt-4" {...props} />
            ),
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            h2: ({ node, ...props }) => (
              <h2 className="text-2xl font-semibold mt-5 mb-2" {...props} />
            ),
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            h3: ({ node, ...props }) => (
              <h3 className="text-xl font-semibold mt-4 mb-2" {...props} />
            ),
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            h4: ({ node, ...props }) => (
              <h4 className="text-lg font-medium mt-3 mb-1" {...props} />
            ),
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            h5: ({ node, ...props }) => (
              <h5 className="text-base font-medium mt-2 mb-1" {...props} />
            ),
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            h6: ({ node, ...props }) => (
              <h6
                className="text-sm font-medium mt-2 mb-1 text-gray-400"
                {...props}
              />
            ),
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            p: ({ node, ...props }) => (
              <p className="prose prose-invert" {...props} />
            ),
            code(props) {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { children, className, node, ref, ...rest } = props;
              const match = /language-(\w+)/.exec(className || '');
              return match ? (
                <div className="not-prose">
                  <SyntaxHighlighter
                    {...rest}
                    PreTag="div"
                    language={match[1]}
                    style={oneDark}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code {...rest} className={className}>
                  {children}
                </code>
              );
            },
          }}
        >
          {readMeContent}
        </ReactMarkdown>
      )}
    </div>
  );
};
