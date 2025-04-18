import { useSignPersonalMessage, useSignTransaction } from '@mysten/dapp-kit';
import { bcs } from '@mysten/sui/bcs';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { IntentScope } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';
import { useEffect, useState } from 'react';
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

  const { mutateAsync: signTransaction } = useSignTransaction();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [pin, setPin] = useState<string>('');
  const [keypair, setKeypair] = useState<Ed25519Keypair | undefined>(undefined);
  const [lastKnownDigest, setLastKnownDigest] = useState<string | undefined>(
    undefined,
  );

  const sleep = (ms = 2500) => new Promise((r) => setTimeout(r, ms));

  const pollLatestTransaction = async (): Promise<string | null> => {
    console.info('🔁 Waiting for signing request...');
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

    if (!lastKnownDigest || latest.digest !== lastKnownDigest) {
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

      const encrypted = new Uint8Array(
        bcs.vector(bcs.u8()).parse(new Uint8Array(tx.inputs[0].value)),
      );
      const resolvedPin = pin || (await requestDecryption(encrypted));
      setPin(resolvedPin);
      setLastKnownDigest(digest);
      const decrypted = await decryptBytes(encrypted, resolvedPin);
      return JSON.parse(new TextDecoder().decode(decrypted)) as Payload;
    } catch {
      throw new Error(`❌ Error while handling digest: ${digest}`);
    }
  };

  const sendEncryptedResponse = async ({
    intent,
    signature,
  }: {
    intent: IntentScope;
    signature: string;
  }): Promise<void> => {
    if (!ephemeralAddress || !keypair) return;

    const tx = new Transaction();
    tx.setSender(ephemeralAddress);
    tx.setGasBudget(10000000);

    const payload = new TextEncoder().encode(
      JSON.stringify({ intent, signature }),
    );
    const encrypted = await encryptBytes(payload, pin);

    tx.pure.vector('u8', fromBase64(encrypted));
    tx.transferObjects([tx.gas], ephemeralAddress);

    await client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
    });
  };

  useEffect(() => {
    if (!ephemeralAddress || !keypair) return;

    let stop = false;

    const monitorRequests = async () => {
      while (!stop) {
        try {
          const digest = await pollLatestTransaction();

          if (digest) {
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
                  await sendEncryptedResponse({
                    intent: payload.intent,
                    signature,
                  });
                }
                break;

              case 'PersonalMessage':
                {
                  const { signature } = await signPersonalMessage({
                    message: fromBase64(payload.bytes),
                    chain: `sui:${payload.network}`,
                  });
                  await sendEncryptedResponse({
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

        await new Promise((r) => setTimeout(r, 2500));
      }
    };

    monitorRequests();

    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ephemeralAddress, keypair, pin]);

  useEffect(() => {
    if (!ephemeralAddress || !!keypair) return;
    const init = async () => {
      while (!keypair) {
        const digest = await pollLatestTransaction();
        if (digest) {
          const payload = await handleIncomingDigest({ digest });
          setKeypair(Ed25519Keypair.fromSecretKey(payload.bytes));
        } else {
          await sleep();
        }
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ephemeralAddress]);

  return (
    <div className="relative min-h-screen text-white overflow-hidden flex flex-col items-center justify-center px-4">
      <Navbar />

      <div className="z-10 flex flex-col items-center text-center mt-24">
        <h2 className="text-5xl font-bold">Authenticate Deployment</h2>
        <p className="mt-4 text-lg text-gray-400">
          Prove authorship. Ensure integrity.
        </p>
        <p className="mt-4 text-lg text-gray-400">
          Sign the request securely with your wallet.
        </p>
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
