import * as Dialog from '@radix-ui/react-dialog';
import { X, Search as SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SearchModal = ({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) => {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const trimmed = input.trim();
  const cleaned = trimmed.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const isWalApp = /^([a-z0-9-]+)\.(wal\.app|localhost:3000)?$/i.test(cleaned);
  const isMvrPath = /^@[\w.-]+\/[\w.-]+$/i.test(input.trim());

  const handleSearch = () => {
    if (isWalApp) {
      navigate(`/site/${cleaned.split('.')[0]}`);
      setOpen(false);
    } else if (isMvrPath) {
      navigate(`/mvr/${trimmed}`);
      setOpen(false);
    } else {
      setError(
        'Enter a valid `.wal.app` URL or MVR path like `@name/package`.',
      );
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-1001" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-1002 w-full max-w-md bg-[#0b0d14] border border-white/10 p-6 rounded-xl shadow-xl">
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
            placeholder="e.g., notary.wal.app or @name/package"
            value={input}
            onChange={(e) => {
              const val = e.target.value;
              setInput(val);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            className="w-full px-3 py-2 rounded-md bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="min-h-[24px] mt-2">
            {error ? (
              <p className="text-sm text-red-500">{error}</p>
            ) : input.trim() ? (
              isMvrPath ? (
                <p className="text-sm text-green-400">
                  MVR package will be verified.
                </p>
              ) : isWalApp ? (
                <p className="text-sm text-green-400">
                  Walrus Site will be verified.
                </p>
              ) : null
            ) : null}
          </div>

          <button
            onClick={handleSearch}
            disabled={!input.trim() || (!isWalApp && !isMvrPath)}
            className={`w-full bg-green-500 text-black font-semibold py-2 rounded-md transition ${
              !input.trim() || (!isWalApp && !isMvrPath)
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-green-600'
            }`}
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
