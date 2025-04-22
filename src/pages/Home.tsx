import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Navbar } from '../components/Navbar';
import { loadSiteConfig } from '../utils/loadSiteConfig';

export const Home = () => {
  const navigate = useNavigate();
  const [network, setNetwork] = useState('testnet');
  const [domain, setDomain] = useState<string>('notary.wal.app');
  const [error, setError] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = `${network === 'mainnet' ? 'https' : 'http'}://${domain}`;
    const match = url.match(
      /^https?:\/\/([a-z0-9-]+)\.(wal\.app|localhost:3000)$/i,
    );
    if (!match) {
      setError(
        'Only `.wal.app` or `.localhost:3000` domains are supported. Please enter a valid address.',
      );
      return;
    }
    setError('');
    navigate(`/site?q=${match[1]}`);
  };

  useEffect(() => {
    loadSiteConfig().then((config) => {
      if (config) {
        setNetwork(config.network);
      }
    });
  }, []);

  return (
    <div className="relative min-h-screen text-white overflow-hidden flex flex-col items-center justify-center px-4">
      <Navbar />

      <div className="z-10 flex flex-col items-center text-center">
        <h2 className="text-5xl font-bold">Verify Your Deployment</h2>
        <p className="mt-4 text-lg text-gray-400">
          Your trusted source of truth.
        </p>
        <form onSubmit={handleSubmit} className="w-full max-w-2xl mt-6">
          <div className="p-[4px] rounded-full bg-gradient-to-r from-purple-500 via-blue-500 to-green-400">
            <div className="flex items-center bg-[#1a1a2e] rounded-full px-4 py-2">
              <span className="text-white px-1 select-none">{`${network === 'mainnet' ? 'https' : 'http'}://`}</span>
              <input
                type="text"
                value={domain}
                onChange={(e) => {
                  const raw = e.target.value;
                  const cleaned = raw
                    .replace(/^https?:\/\//, '')
                    .replace(/\/$/, '');

                  const url = `${network === 'mainnet' ? 'https' : 'http'}://${cleaned}`;
                  const match = url.match(
                    /^https?:\/\/([a-z0-9-]+)\.(wal\.app|localhost:3000)$/i,
                  );

                  setError(
                    match
                      ? ''
                      : 'Only `.wal.app` or `.localhost:3000` domains are supported. Please enter a valid address.',
                  );
                  setDomain(cleaned);
                }}
                placeholder="notary.wal.app"
                className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none py-2"
              />
              <button
                type="submit"
                className={`bg-green-400 text-black rounded-full w-10 h-10 flex items-center justify-center transition-colors ${
                  error
                    ? 'opacity-50 cursor-not-allowed pointer-events-none'
                    : 'hover:bg-green-500 cursor-pointer'
                }`}
                aria-label="Verify"
                disabled={!!error}
              >
                <Check />
              </button>
            </div>
          </div>
        </form>
        <div className="min-h-[24px] mt-2">
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </div>

      <img
        src="/globe_big.png"
        alt="Globe"
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[1200px] z-0 pointer-events-none"
        loading="lazy"
      />
    </div>
  );
};
