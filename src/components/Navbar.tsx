import { Github, BookOpen, Info, Check } from 'lucide-react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { NETWORK } from '../utils/getSiteResources';

export const Navbar = ({
  showInput = false,
  prefix,
}: {
  showInput?: boolean;
  prefix?: string;
}) => {
  const [domain, setDomain] = useState<string>(
    prefix ? `${prefix}.wal.app` : 'notary.wal.app',
  );
  const [error, setError] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = `${NETWORK === 'mainnet' ? 'https' : 'http'}://${domain}`;
    const match = url.match(
      /^https?:\/\/([a-z0-9-]+)\.(wal\.app|localhost:3000)$/i,
    );
    if (!match) {
      setError(true);
      return;
    }
    setError(false);
    navigate(`/site?q=${match[1]}`);
  };

  return (
    <nav className="w-full h-16 px-4 bg-[#0b0d14] fixed top-0 z-30 backdrop-blur-md bg-black/20">
      <div className="flex justify-between items-center h-full max-w-7xl mx-auto w-full">
        <RouterLink to="/" className="text-white text-lg font-semibold">
          <span className="text-green-400">notary</span>.wal.app
        </RouterLink>

        {showInput ? (
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <span className="text-white select-none">{`${NETWORK === 'mainnet' ? 'https' : 'http'}://`}</span>
            <input
              type="text"
              value={domain}
              onChange={(e) => {
                const url = `${NETWORK === 'mainnet' ? 'https' : 'http'}://${e.target.value}`;
                const match = url.match(
                  /^https?:\/\/([a-z0-9-]+)\.(wal\.app|localhost:3000)$/i,
                );
                setError(!match);
                setDomain(e.target.value);
              }}
              placeholder="notary.wal.app"
              className="flex-1 min-w-[200px] bg-transparent text-white placeholder-gray-400 focus:outline-none border-b border-gray-600 py-1"
            />
            <button
              type="submit"
              className={`bg-green-400 text-black rounded-full w-6 h-6 flex items-center justify-center transition-colors ${
                error
                  ? 'opacity-50 cursor-not-allowed pointer-events-none'
                  : 'hover:bg-green-500 cursor-pointer'
              }`}
              aria-label="Verify"
              disabled={error}
            >
              <Check className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <a
              href="https://github.com/zktx-io/walrus-sites-provenance"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:underline"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
            <a
              href="https://docs.walrus.site"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:underline"
            >
              <BookOpen className="w-4 h-4" />
              Walrus
            </a>
            <a
              href="https://docs.zktx.io"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:underline"
            >
              <Info className="w-4 h-4" />
              zktx.io
            </a>
          </div>
        )}
      </div>
    </nav>
  );
};
