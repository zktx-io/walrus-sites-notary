export interface SourceFailureContext {
  repoUrl: string;
  tag: string;
  path: string;
}

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

const addUnique = (items: string[], item?: string) => {
  if (item && !items.includes(item)) {
    items.push(item);
  }
};

const describeGitHubUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);

    if (url.hostname === 'raw.githubusercontent.com' && parts.length >= 4) {
      const [owner, repo, ...rest] = parts;
      return `GitHub file: ${owner}/${repo}/${rest.join('/')}`;
    }

    if (
      url.hostname === 'api.github.com' &&
      parts[0] === 'repos' &&
      parts[3] === 'git' &&
      parts[4] === 'trees'
    ) {
      return `GitHub tree: ${parts[1]}/${parts[2]} @ ${decodeURIComponent(
        parts.slice(5).join('/'),
      )}`;
    }

    if (url.hostname === 'github.com' && parts.length >= 2) {
      return `GitHub source: ${parts.join('/')}`;
    }

    return value;
  } catch {
    return null;
  }
};

export const extractSourceFailureHints = (
  error: string,
  fallback?: SourceFailureContext,
): string[] => {
  const hints: string[] = [];
  const cleanError = error.replace(ANSI_REGEX, '');

  for (const match of cleanError.matchAll(
    /(?:Dependency|Manifest dependency|Local dependency) '([^']+)'(?: from ([^\n]+)| at '([^']+)')?/gi,
  )) {
    const [, name, source, localPath] = match;
    addUnique(
      hints,
      source || localPath
        ? `Dependency ${name}: ${(source ?? localPath).trim()}`
        : `Dependency ${name}`,
    );
  }

  for (const match of cleanError.matchAll(
    /https?:\/\/(?:raw\.githubusercontent\.com|api\.github\.com|github\.com)\/[^\s'"<>`)]+/gi,
  )) {
    addUnique(hints, describeGitHubUrl(match[0]) ?? match[0]);
  }

  if (
    hints.length === 0 &&
    fallback &&
    /github|repository|repo|failed to fetch|rate limit|403|404|401/i.test(
      cleanError,
    )
  ) {
    addUnique(
      hints,
      `Root package: ${fallback.repoUrl}/tree/${fallback.tag}/${fallback.path}`,
    );
  }

  return hints.slice(0, 5);
};
