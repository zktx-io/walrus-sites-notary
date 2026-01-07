import { fromBase64 } from '@mysten/sui/utils';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

import { MvrData } from '../utils/getMvrData';

export const MvrReadMe = ({ mvrData }: { mvrData: MvrData }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [readMeContent, setReadMeContent] = useState<string | undefined>(
    undefined,
  );

  // Convert relative paths to GitHub URLs
  const resolveRelativePath = (path: string): string => {
    // If already absolute URL, return as is
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // If no git info, return as is
    if (
      !mvrData.git_info?.repository_url ||
      !mvrData.git_info?.path ||
      !mvrData.git_info?.tag
    ) {
      return path;
    }

    // Extract owner and repo from repository URL
    const repoUrl = mvrData.git_info.repository_url;
    const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
    if (!match) {
      return path;
    }

    const repoPath = match[1];
    let basePath = mvrData.git_info.path;
    const branch = mvrData.git_info.tag;

    // Remove 'packages/' prefix if it exists (API path may include it but web doesn't)
    if (basePath.startsWith('packages/')) {
      basePath = basePath.substring('packages/'.length);
    }

    // Get README directory (remove filename)
    const readmeDirParts = basePath.split('/').filter(Boolean).slice(0, -1);
    const readmeDir = readmeDirParts.join('/');

    // Resolve relative path
    let resolvedPath: string;
    if (path.startsWith('./')) {
      // Relative to README.md directory: ./assets/image.svg
      const relativePath = path.substring(2);
      if (readmeDir) {
        resolvedPath = `${readmeDir}/${relativePath}`;
      } else {
        resolvedPath = relativePath;
      }
    } else if (path.startsWith('../')) {
      // Go up directories: ../other/file.md
      const dirParts = [...readmeDirParts];
      let relativePath = path;

      // Count how many levels to go up
      while (relativePath.startsWith('../')) {
        if (dirParts.length > 0) {
          dirParts.pop();
        }
        relativePath = relativePath.substring(3);
      }

      if (dirParts.length > 0) {
        resolvedPath = `${dirParts.join('/')}/${relativePath}`;
      } else {
        resolvedPath = relativePath;
      }
    } else if (path.startsWith('/')) {
      // Absolute path from repo root: /docs/file.md
      resolvedPath = path.substring(1);
    } else {
      // Relative path without ./: assets/image.svg
      if (readmeDir) {
        resolvedPath = `${readmeDir}/${path}`;
      } else {
        resolvedPath = path;
      }
    }

    // Normalize path: remove ./, //, trailing slashes
    resolvedPath = resolvedPath
      .split('/')
      .filter((part) => part !== '.' && part !== '')
      .join('/')
      .replace(/\/{2,}/g, '/');

    // Remove 'packages/' prefix from resolved path if it exists
    if (resolvedPath.startsWith('packages/')) {
      resolvedPath = resolvedPath.substring('packages/'.length);
    }

    // Construct GitHub URL
    return `https://github.com/${repoPath}/blob/${branch}/${resolvedPath}`;
  };

  // Convert relative paths in HTML img tags
  const convertHtmlImagePaths = (content: string): string => {
    if (
      !mvrData.git_info?.repository_url ||
      !mvrData.git_info?.path ||
      !mvrData.git_info?.tag
    ) {
      return content;
    }

    // Match img tags with src attributes
    return content.replace(
      /<img\s+([^>]*\s+)?src=["']([^"']+)["']([^>]*)>/gi,
      (_match, before, src, after) => {
        const resolvedSrc = resolveRelativePath(src);
        // Add ?raw=true for images if it's a GitHub URL
        let finalSrc = resolvedSrc;
        if (
          resolvedSrc.startsWith('https://github.com/') &&
          !resolvedSrc.includes('?raw=true')
        ) {
          finalSrc = `${resolvedSrc}?raw=true`;
        }
        return `<img ${before || ''}src="${finalSrc}"${after || ''}>`;
      },
    );
  };

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
            // Convert HTML image paths before setting content
            const processedContent = convertHtmlImagePaths(decodedContent);
            setReadMeContent(processedContent);
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
    <div className="p-6 rounded-lg mb-8 bg-white/3 backdrop-blur-md border border-white/5">
      {loading && <p className="text-gray-300">Loading...</p>}
      {error && (
        <div className="flex items-center gap-2 text-yellow-400 font-medium">
          <AlertTriangle className="w-5 h-5" />
          Failed to load README
        </div>
      )}
      {readMeContent && (
        <div className="markdown-body text-base leading-7 text-[#c9d1d9]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              h1: ({ node, ...props }) => (
                <h1
                  className="text-2xl font-semibold mt-0 mb-4 pb-2 border-b border-[#30363d] text-[#c9d1d9]"
                  {...props}
                />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              h2: ({ node, ...props }) => (
                <h2
                  className="text-xl font-semibold mt-8 mb-4 pb-2 border-b border-[#30363d] text-[#c9d1d9]"
                  {...props}
                />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              h3: ({ node, ...props }) => (
                <h3
                  className="text-lg font-semibold mt-6 mb-4 text-[#c9d1d9]"
                  {...props}
                />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              h4: ({ node, ...props }) => (
                <h4
                  className="text-base font-semibold mt-4 mb-3 text-[#c9d1d9]"
                  {...props}
                />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              h5: ({ node, ...props }) => (
                <h5
                  className="text-sm font-semibold mt-4 mb-2 text-[#c9d1d9]"
                  {...props}
                />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              h6: ({ node, ...props }) => (
                <h6
                  className="text-sm font-semibold mt-4 mb-2 text-[#8b949e]"
                  {...props}
                />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              p: ({ node, ...props }) => (
                <p className="mb-4 text-[#c9d1d9] leading-7" {...props} />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              ul: ({ node, ...props }) => (
                <ul
                  className="mb-4 ml-6 list-disc text-[#c9d1d9] space-y-1"
                  {...props}
                />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              ol: ({ node, ...props }) => (
                <ol
                  className="mb-4 ml-6 list-decimal text-[#c9d1d9] space-y-1"
                  {...props}
                />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              li: ({ node, ...props }) => (
                <li className="leading-7 text-[#c9d1d9]" {...props} />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              a: ({ node, ...props }) => {
                const href = (props.href as string) || '';
                const resolvedHref = resolveRelativePath(href);
                return (
                  <a
                    className="text-[#58a6ff] no-underline hover:underline"
                    target="_blank"
                    rel="noreferrer"
                    {...props}
                    href={resolvedHref}
                  />
                );
              },
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              blockquote: ({ node, ...props }) => (
                <blockquote
                  className="pl-4 ml-0 my-4 border-l-4 border-[#30363d] text-[#8b949e] italic"
                  {...props}
                />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              img: ({ node, ...props }) => {
                const src = (props.src as string) || '';
                let resolvedSrc = resolveRelativePath(src);
                // Add ?raw=true for images to display directly
                if (
                  resolvedSrc.startsWith('https://github.com/') &&
                  !resolvedSrc.includes('?raw=true')
                ) {
                  resolvedSrc = `${resolvedSrc}?raw=true`;
                }
                return (
                  <img
                    className="max-w-full my-4 rounded-md border border-[#30363d]"
                    alt=""
                    {...props}
                    src={resolvedSrc}
                  />
                );
              },
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              hr: ({ node, ...props }) => (
                <hr className="my-8 border-t border-[#30363d]" {...props} />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              strong: ({ node, ...props }) => (
                <strong className="font-semibold text-[#c9d1d9]" {...props} />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              em: ({ node, ...props }) => (
                <em className="italic text-[#c9d1d9]" {...props} />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              table: ({ node, ...props }) => (
                <div className="overflow-x-auto my-4">
                  <table
                    className="min-w-full border-collapse border border-[#30363d] rounded-md"
                    {...props}
                  />
                </div>
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              thead: ({ node, ...props }) => (
                <thead className="bg-[#161b22]" {...props} />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              tbody: ({ node, ...props }) => (
                <tbody className="bg-transparent" {...props} />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              tr: ({ node, ...props }) => (
                <tr
                  className="border-t border-[#30363d] hover:bg-[#161b22]"
                  {...props}
                />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              th: ({ node, ...props }) => (
                <th
                  className="px-4 py-2 text-left font-semibold text-[#c9d1d9] border border-[#30363d]"
                  {...props}
                />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              td: ({ node, ...props }) => (
                <td
                  className="px-4 py-2 text-[#c9d1d9] border border-[#30363d]"
                  {...props}
                />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              pre: ({ node, ...props }) => {
                // pre always applies code block styles
                return (
                  <pre
                    className="my-4 rounded-md overflow-x-auto bg-[#161b22] p-4 font-mono text-sm"
                    style={{
                      fontFamily:
                        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                    }}
                    {...props}
                  />
                );
              },
              code(props) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { children, className, node, ref, ...rest } = props;
                const match = /language-(\w+)/.exec(className || '');
                const isInline = !className;

                if (isInline) {
                  // inline code
                  return (
                    <code
                      {...rest}
                      className="px-1.5 py-0.5 bg-[#6e768166] rounded text-sm font-mono text-[#c9d1d9]"
                    >
                      {children}
                    </code>
                  );
                }

                // code block - use SyntaxHighlighter
                // inside pre tag, so set PreTag to code and handle pre styles in parent
                let codeContent = String(children);
                // remove all leading and trailing whitespace/newlines
                codeContent = codeContent.trim();
                // remove leading whitespace from first line
                if (codeContent.length > 0) {
                  codeContent = codeContent.replace(/^\s+/, '');
                }
                return (
                  <SyntaxHighlighter
                    {...rest}
                    PreTag="code"
                    language={match ? match[1] : 'text'}
                    style={oneDark}
                    customStyle={{
                      margin: 0,
                      padding: 0,
                      background: 'transparent',
                    }}
                    lineStyle={{
                      background: 'transparent',
                    }}
                    codeTagProps={{
                      style: {
                        fontFamily:
                          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                        fontSize: '85%',
                        color: '#c9d1d9',
                        background: 'transparent',
                        padding: 0,
                        margin: 0,
                      },
                    }}
                  >
                    {codeContent}
                  </SyntaxHighlighter>
                );
              },
            }}
          >
            {readMeContent}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};
