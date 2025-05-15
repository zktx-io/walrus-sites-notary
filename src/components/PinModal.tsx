import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useState } from 'react';

export const PinModal = ({
  open,
  onOpenChange,
  onSubmit,
  errorMessage,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onSubmit: (pin: string) => void;
  errorMessage?: string;
}) => {
  const [pin, setPin] = useState('');

  const handleSubmit = () => {
    if (pin.trim()) onSubmit(pin.trim());
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-1001" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-1002 w-full max-w-md bg-[#0b0d14] border border-white/10 p-6 rounded-xl shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-xl font-semibold text-white">
              Enter PIN
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

          <p className="text-sm text-gray-400 mb-4">
            This PIN should match the <strong>GIT_SIGNER_PIN</strong> in your
            GitHub Secrets.
          </p>

          <input
            autoFocus
            type="password"
            placeholder="Enter your PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
            className="w-full px-3 py-2 rounded-md bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          />

          <div className="min-h-[24px] mt-2">
            {errorMessage ? (
              <p className="text-sm text-red-500">{errorMessage}</p>
            ) : null}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!pin.trim()}
            className={`w-full bg-green-500 text-black font-semibold py-2 rounded-md transition ${
              !pin.trim()
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-green-600'
            }`}
          >
            Submit
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
