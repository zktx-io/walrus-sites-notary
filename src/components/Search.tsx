import * as Dialog from '@radix-ui/react-dialog';
import { X, Search as SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { loadSiteConfig } from '../utils/loadSiteConfig';

const SearchModal = ({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) => {
  const navigate = useNavigate();
  const [network, setNetwork] = useState('testnet');
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleSearch = () => {
    const cleanedInput = input.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const protocol = network === 'mainnet' ? 'https' : 'http';
    const url = `${protocol}://${cleanedInput}`;

    const match = url.match(
      /^https?:\/\/([a-z0-9-]+)\.(wal\.app|localhost:3000)$/i,
    );

    if (!match) {
      setError(true);
      return;
    }

    setError(false);
    navigate(`/site?q=${match[1]}`);
    setOpen(false);
  };

  useEffect(() => {
    loadSiteConfig().then((config) => {
      if (config) {
        setNetwork(config.network);
      }
    });
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-[#0b0d14] border border-white/10 p-6 rounded-xl shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-xl font-semibold text-white">
              Site Search
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="text-white hover:text-gray-300"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <input
            autoFocus
            type="text"
            placeholder="Search wal.app subdomain..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            className="w-full px-3 py-2 rounded-md bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {error && (
            <p className="text-sm text-red-500 mt-2">
              Invalid wal.app or localhost domain.
            </p>
          )}

          <button
            onClick={handleSearch}
            className="mt-4 w-full bg-green-500 hover:bg-green-600 text-black font-semibold py-2 rounded-md transition"
          >
            Verify
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export const Search = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-full hover:bg-white/10 transition"
        aria-label="Open search"
      >
        <SearchIcon className="w-5 h-5 text-white" />
      </button>

      {open && <SearchModal open={open} setOpen={setOpen} />}
    </>
  );
};
