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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 bg-[#0b0d14] border border-white/10 p-6 rounded-xl shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-xl font-semibold text-white">
              Enter PIN
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-white hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <p className="text-sm text-gray-400 mb-4">
            This PIN should match the <strong>GIT_SIGNER_PIN</strong> in your
            GitHub Secrets.
          </p>

          <input
            type="password"
            placeholder="Enter your PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          />

          {errorMessage && (
            <p className="mt-2 text-sm text-red-500">{errorMessage}</p>
          )}

          <button
            onClick={() => onSubmit(pin)}
            className="mt-4 w-full bg-green-500 hover:bg-green-600 text-black font-semibold py-2 rounded-md transition"
          >
            Submit
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
