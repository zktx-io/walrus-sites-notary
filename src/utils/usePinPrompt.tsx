import { useState } from 'react';

import { PinModal } from '../components/PinModal';
import { decryptBytes } from '../utils/gitSigner';

export const usePinPrompt = () => {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [resolver, setResolver] = useState<((result: string) => void) | null>(
    null,
  );
  const [rejecter, setRejecter] = useState<((err: unknown) => void) | null>(
    null,
  );
  const [encrypted, setEncrypted] = useState<Uint8Array | null>(null);

  const requestDecryption = (data: Uint8Array): Promise<string> => {
    return new Promise((resolve, reject) => {
      setEncrypted(data);
      setOpen(true);
      setResolver(() => resolve);
      setRejecter(() => reject);
    });
  };

  const handleSubmit = async (pin: string) => {
    if (!encrypted) return;
    try {
      await decryptBytes(encrypted, pin);
      setErrorMessage(undefined);
      setOpen(false);
      resolver?.(pin);
    } catch {
      setErrorMessage('Invalid PIN. Please try again.');
    }
  };

  return {
    requestDecryption,
    pinModal: (
      <PinModal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) rejecter?.(new Error('Modal closed'));
        }}
        onSubmit={handleSubmit}
        errorMessage={errorMessage}
      />
    ),
  };
};
