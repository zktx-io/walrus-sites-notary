import { Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { BackgroundFx } from '../components/BackgroundFx';
import { Navbar } from '../components/Navbar';

export const Home = () => {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();

    const cleaned = trimmed.replace(/^https?:\/\//, '').replace(/\/$/, '');

    // Check if it's a valid wal.app URL
    const isWalApp = /^([a-z0-9-]+)\.(wal\.app|localhost:3000)?$/i.test(
      cleaned,
    );
    // Check if it's an MVR path like @name/package
    const isMvrPath = /^@[\w.-]+\/[\w.-]+$/i.test(trimmed);

    if (isWalApp) {
      setError('');
      navigate(`/site/${cleaned.split('.')[0]}`);
    } else if (isMvrPath) {
      setError('');
      navigate(`/mvr/${trimmed}`);
    } else {
      setError(
        'Enter a valid `.wal.app` URL or MVR path like `@name/package`.',
      );
    }
  };

  return (
    <div className="relative min-h-screen text-white overflow-hidden flex flex-col items-center justify-center px-4">
      <BackgroundFx />
      <Navbar />

      <div className="z-10 flex flex-col items-center text-center">
        <h2 className="text-5xl font-bold">Verify Your Deployment</h2>
        <p className="mt-4 text-lg text-gray-400">
          Your trusted source of truth.
        </p>
        <form onSubmit={handleSubmit} className="w-full max-w-2xl mt-6">
          <div className="p-[4px] rounded-full bg-gradient-to-r from-purple-500 via-blue-500 to-green-400">
            <div className="flex items-center bg-[#1a1a2e] rounded-full px-4 py-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  const raw = e.target.value;
                  setInputValue(raw);

                  if (raw.trim() === '') {
                    setError('');
                    return;
                  }

                  const cleanedForCheck = raw
                    .replace(/^https?:\/\//, '')
                    .replace(/\/$/, '');
                  const isWalApp =
                    /^([a-z0-9-]+)\.(wal\.app|localhost:3000)?$/i.test(
                      cleanedForCheck,
                    );
                  const isMvrPath = /^@[\w.-]+\/[\w.-]+$/i.test(raw);

                  if (isWalApp || isMvrPath) {
                    setError('');
                  } else {
                    setError('Enter a valid .wal.app URL or an MVR path.');
                  }
                }}
                placeholder="e.g., notary.wal.app or @name/package"
                className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none py-2"
              />
              <button
                type="submit"
                className={`bg-green-400 text-black rounded-full w-10 h-10 flex items-center justify-center transition-colors ${
                  error || !inputValue.trim()
                    ? 'opacity-50 cursor-not-allowed pointer-events-none'
                    : 'hover:bg-green-500 cursor-pointer'
                }`}
                aria-label="Verify"
                disabled={!!error || !inputValue.trim()}
              >
                <Check />
              </button>
            </div>
          </div>
        </form>
        <div className="min-h-[24px] mt-2 text-center">
          {error ? (
            <p className="text-sm text-red-500 break-words whitespace-pre-wrap w-full">
              {error}
            </p>
          ) : inputValue ? (
            /^@[\w.-]+\/[\w.-]+$/.test(inputValue.trim()) ? (
              <p className="text-sm text-green-400">
                Move package from MVR will be verified.
              </p>
            ) : /^([a-z0-9-]+)\.(wal\.app|localhost)(?::(3000|5173))?$/i.test(
                inputValue
                  .trim()
                  .replace(/^https?:\/\//, '')
                  .replace(/\/$/, ''),
              ) ? (
              <p className="text-sm text-green-400">
                Walrus Site will be verified.
              </p>
            ) : null
          ) : null}
        </div>
      </div>
    </div>
  );
};
