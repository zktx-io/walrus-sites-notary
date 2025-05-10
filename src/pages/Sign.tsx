import {
  useSignPersonalMessage,
  useSignTransaction,
  useCurrentAccount,
} from '@mysten/dapp-kit';
import { bcs } from '@mysten/sui/bcs';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { IntentScope, Keypair } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { sha256 } from '@noble/hashes/sha256';
import confetti from 'canvas-confetti';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Navbar } from '../components/Navbar';
import { decryptBytes, encryptBytes } from '../utils/gitSigner';
import { usePinPrompt } from '../utils/usePinPrompt';

interface Payload {
  intent: IntentScope;
  network: 'testnet' | 'mainnet';
  address: string;
  bytes: string;
}

export const Sign = () => {
  const [searchParams] = useSearchParams();
  const { requestDecryption, pinModal } = usePinPrompt();
  const ephemeralAddress = searchParams.get('q');
  const client = new SuiClient({ url: getFullnodeUrl('devnet') });

  const currentAccount = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [deployedUrl, setDeployedUrl] = useState<string | undefined>(undefined);
  const [statusText, setStatusText] = useState<string>(
    'Initializing signer...',
  );
  const keypairRef = useRef<Ed25519Keypair | undefined>(undefined);
  const lastKnownDigestRef = useRef<string | undefined>(undefined);
  const pinRef = useRef<string | undefined>(undefined);
  const hasFiredRef = useRef(false);

  const sleep = (ms = 2500) => new Promise((r) => setTimeout(r, ms));

  const pollLatestTransaction = async (): Promise<string | null> => {
    if (!ephemeralAddress) return null;

    const { data } = await client.queryTransactionBlocks({
      filter: { FromAddress: ephemeralAddress },
      order: 'descending',
      options: { showInput: true },
    });

    if (data.length === 0) {
      return null;
    }

    const [latest] = data;

    if (
      !lastKnownDigestRef.current ||
      latest.digest !== lastKnownDigestRef.current
    ) {
      return latest.digest;
    }

    return null;
  };

  const handleIncomingDigest = async ({
    digest,
  }: {
    digest: string;
  }): Promise<Payload> => {
    try {
      const txBlock = await client.getTransactionBlock({
        digest,
        options: { showInput: true },
      });

      const tx = txBlock.transaction?.data?.transaction;
      if (
        !tx ||
        tx.kind !== 'ProgrammableTransaction' ||
        tx.inputs.length === 0 ||
        tx.inputs[0].type !== 'pure' ||
        !Array.isArray(tx.inputs[0].value)
      ) {
        throw new Error('Invalid transaction input structure.');
      }

      if (!bcs.Bool.parse(new Uint8Array(tx.inputs[0].value))) {
        throw new Error('self signed transaction not allowed');
      }

      const encryptedChunks: Uint8Array[] = tx.inputs
        .slice(1)
        .filter(
          (input): input is { type: 'pure'; value: number[] } =>
            input.type === 'pure' &&
            typeof input === 'object' &&
            'value' in input &&
            Array.isArray((input as { value?: unknown }).value),
        )
        .map((input) => new Uint8Array(input.value));

      if (encryptedChunks.length < 1) {
        throw new Error('Invalid encrypted structure or missing flag.');
      }
      const parsedChunks: Uint8Array[] = encryptedChunks.map(
        (chunk) => new Uint8Array(bcs.vector(bcs.u8()).parse(chunk)),
      );

      const totalLength = parsedChunks.reduce(
        (sum, chunk) => sum + chunk.length,
        0,
      );
      const fullEncrypted = new Uint8Array(totalLength);

      let offset = 0;
      for (const chunk of parsedChunks) {
        fullEncrypted.set(chunk, offset);
        offset += chunk.length;
      }

      const resolvedPin =
        pinRef.current || (await requestDecryption(fullEncrypted));
      pinRef.current = resolvedPin;
      lastKnownDigestRef.current = digest;
      const decrypted = await decryptBytes(fullEncrypted, resolvedPin);
      return JSON.parse(new TextDecoder().decode(decrypted)) as Payload;
    } catch {
      throw new Error(`❌ Error while handling digest: ${digest}`);
    }
  };

  const sendEncryptedResponse = async (
    ephemeralKeypair: Keypair,
    {
      intent,
      signature,
    }: {
      intent: IntentScope;
      signature: string;
    },
  ): Promise<void> => {
    if (!ephemeralAddress || !ephemeralKeypair || !pinRef.current) return;

    setStatusText('Sending signed response...');

    const tx = new Transaction();
    tx.setSender(ephemeralAddress);
    tx.setGasBudget(10000000);

    const payload = new TextEncoder().encode(
      JSON.stringify({ intent, signature }),
    );
    const encrypted = await encryptBytes(payload, pinRef.current);

    tx.pure.bool(false);
    tx.pure.vector('u8', fromBase64(encrypted));
    tx.transferObjects([tx.gas], ephemeralAddress);

    const { digest } = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: ephemeralKeypair,
    });
    await client.waitForTransaction({ digest });
    lastKnownDigestRef.current = digest;
  };

  useEffect(() => {
    if (!ephemeralAddress || !keypairRef.current || !currentAccount) return;

    let stop = false;

    const monitorRequests = async (keypair: Ed25519Keypair) => {
      while (!stop) {
        try {
          setStatusText('Waiting for signing requests…');
          const digest = await pollLatestTransaction();
          if (digest) {
            setStatusText('Signing request…');
            const payload = await handleIncomingDigest({ digest });
            switch (payload.intent) {
              case 'TransactionData':
                {
                  const { signature } = await signTransaction({
                    transaction: await Transaction.from(
                      fromBase64(payload.bytes),
                    ).toJSON(),
                    chain: `sui:${payload.network}`,
                  });
                  await sendEncryptedResponse(keypair, {
                    intent: payload.intent,
                    signature,
                  });
                }
                break;

              case 'PersonalMessage':
                if (
                  new TextDecoder()
                    .decode(fromBase64(payload.bytes))
                    .startsWith('{"url":"')
                ) {
                  const { url } = JSON.parse(
                    new TextDecoder().decode(fromBase64(payload.bytes)),
                  );
                  setDeployedUrl(url);
                  setStatusText('Deployment complete.');
                  stop = true;
                  return;
                } else {
                  const { signature } = await signPersonalMessage({
                    message: fromBase64(payload.bytes),
                    chain: `sui:${payload.network}`,
                  });
                  await sendEncryptedResponse(keypair, {
                    intent: payload.intent,
                    signature,
                  });
                }
                break;
              default:
                break;
            }
          }
        } catch (e) {
          console.error('❌ Error in monitorRequests:', e);
        }
        await sleep();
      }
    };

    monitorRequests(keypairRef.current);

    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ephemeralAddress, currentAccount, keypairRef.current]);

  useEffect(() => {
    if (!ephemeralAddress || !!keypairRef.current) return;

    if (!currentAccount) {
      return;
    }

    const init = async () => {
      while (!keypairRef.current) {
        const { data } = await client.queryTransactionBlocks({
          filter: { FromAddress: ephemeralAddress },
          order: 'ascending',
          options: { showInput: true },
        });

        if (data.length > 0) {
          const [first] = data;

          if (first.digest) {
            const payload = await handleIncomingDigest({
              digest: first.digest,
            });
            const parsed = JSON.parse(
              new TextDecoder().decode(fromBase64(payload.bytes)),
            );
            const ephemeralKeypair = Ed25519Keypair.fromSecretKey(
              parsed.secretKey,
            );

            keypairRef.current = ephemeralKeypair;

            if (data.length === 1) {
              const { signature } = await signPersonalMessage({
                message: new TextEncoder().encode(
                  toBase64(sha256(fromBase64(payload.bytes))),
                ),
                chain: `sui:${payload.network}`,
              });
              await sendEncryptedResponse(ephemeralKeypair, {
                intent: payload.intent,
                signature,
              });
            } else {
              setStatusText('Waiting for signing requests…');
              lastKnownDigestRef.current = data[1].digest;
            }
          } else {
            await sleep();
          }
        }
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ephemeralAddress, currentAccount]);

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

      <img
        src="/globe_big.png"
        alt="Globe"
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[1200px] z-0 pointer-events-none"
        loading="lazy"
      />
    </div>
  );
};
