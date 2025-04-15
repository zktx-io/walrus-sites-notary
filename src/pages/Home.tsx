import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';

export const Home = () => {
  const navigate = useNavigate();
  const [domain, setDomain] = useState<string>('notary.wal.app');
  const [error, setError] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = `https://${domain}`;
    const match = url.match(/^https:\/\/([a-z0-9-]+)\.wal\.app$/i);
    if (!match) {
      setError(
        'Only `.wal.app` domains are supported. Please enter a valid address.',
      );
      return;
    }
    setError('');
    navigate(`/site?q=${match[1]}`);
  };

  return (
    <div className="relative min-h-screen text-white overflow-hidden flex items-center justify-center">
      <div className="z-10 flex flex-col items-center text-center px-4">
        <h1 className="text-5xl font-bold">Verify Your Deployment</h1>
        <p className="m-4  text-lg text-gray-400">
          Your trusted source of truth.
        </p>
        <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
          <div className="p-[4px] rounded-full bg-gradient-to-r from-purple-500 via-blue-500 to-green-400">
            <div className="flex items-center bg-[#1a1a2e] rounded-full px-4 py-2">
              <span className="text-white px-1 select-none">https://</span>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="notary.wal.app"
                className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none py-2"
              />
              <button
                type="submit"
                className="ml-2 bg-green-400 hover:bg-green-500 text-black rounded-full p-3"
                aria-label="Verify"
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
