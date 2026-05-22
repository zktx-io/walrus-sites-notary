import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import confetti from 'canvas-confetti';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { BackgroundFx } from '../components/BackgroundFx';
import { Navbar } from '../components/Navbar';
import { useSignerSession } from '../hooks/useSignerSession';
import { usePinPrompt } from '../utils/usePinPrompt';

export const Sign = () => {
  const [searchParams] = useSearchParams();
  const { requestDecryption, pinModal } = usePinPrompt();
  const currentAccount = useCurrentAccount();
  const dAppKit = useDAppKit();
  const hasFiredRef = useRef(false);

  const ephemeralAddress = searchParams.get('q');
  const { deployedUrl, statusText } = useSignerSession({
    ephemeralAddress,
    walletAddress: currentAccount?.address,
    dAppKit,
    requestDecryption,
  });

  useEffect(() => {
    const fire = (particleRatio: number, opts: { [key: string]: number }) => {
      confetti({
        ...{
          origin: { y: 0.7 },
        },
        ...opts,
        particleCount: Math.floor(200 * particleRatio),
      });
    };
    if (deployedUrl && !hasFiredRef.current) {
      hasFiredRef.current = true;
      fire(0.25, {
        spread: 26,
        startVelocity: 55,
      });
      fire(0.2, {
        spread: 60,
      });
      fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8,
      });
      fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2,
      });
      fire(0.1, {
        spread: 120,
        startVelocity: 45,
      });
    }
  }, [deployedUrl]);

  return (
    <div className="relative min-h-screen text-white overflow-hidden flex flex-col items-center justify-center px-4">
      <BackgroundFx />
      <Navbar />

      <div className="z-10 flex flex-col items-center text-center">
        <h2 className="text-5xl font-bold">Authenticate Deployment</h2>
        <p className="mt-4 text-lg text-gray-400">
          Prove authorship. Ensure integrity.
        </p>
        <p className="mt-4 text-lg text-gray-400">
          Sign the request securely with your wallet.
        </p>

        <div className="z-10 flex flex-col items-center text-center mt-20">
          {!currentAccount ? (
            <div className="flex items-center gap-2 text-yellow-400 bg-yellow-900/20 px-4 py-2 rounded-lg border border-yellow-400/30">
              <div>
                <h2 className="text-lg font-semibold">Wallet Not Connected</h2>
                <p className="text-sm text-yellow-300 mt-1">
                  Please connect your wallet to start signing.
                </p>
              </div>
            </div>
          ) : !deployedUrl ? (
            <h2 className="text-2xl font-semibold text-white">{statusText}</h2>
          ) : (
            <div className="mt-8 text-center">
              <h3 className="text-2xl font-semibold text-white">
                Deployment complete
              </h3>
              <a
                href={deployedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block bg-gray-100/10 text-gray-300 border border-gray-500/20 px-4 py-2 rounded-md hover:bg-gray-100/20 hover:text-white transition"
              >
                View site
              </a>
            </div>
          )}
        </div>
      </div>

      {pinModal}
    </div>
  );
};
