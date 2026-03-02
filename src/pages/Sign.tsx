import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { bcs } from '@mysten/sui/bcs';
import { IntentScope, Keypair } from '@mysten/sui/cryptography';
import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { sha256 } from '@noble/hashes/sha256';
import confetti from 'canvas-confetti';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { BackgroundFx } from '../components/BackgroundFx';
import { Navbar } from '../components/Navbar';
import { decryptBytes, encryptBytes } from '../utils/gitSigner';
import { usePinPrompt } from '../utils/usePinPrompt';

// Sign page is chain-fixed to devnet (ephemeral keypair handshake flow).
// Rationale: this is a signing relay that always runs on devnet for
// ephemeral transaction broadcast; the target chain is in the payload.
const SIGN_NETWORK = 'devnet' as const;

const GRPC_URL = 'https://fullnode.devnet.sui.io:443';
const GQL_URL = 'https://graphql.devnet.sui.io/graphql';

const grpcClient = new SuiGrpcClient({
  network: SIGN_NETWORK,
  baseUrl: GRPC_URL,
});

const gqlClient = new SuiGraphQLClient({
  network: SIGN_NETWORK,
  url: GQL_URL,
});

interface Payload {
  intent: IntentScope;
  network: 'testnet' | 'mainnet';
  address: string;
  bytes: string;
}

// queryTransactionBlocks is GraphQL-only in 2.x.
// Using GraphQL to query transactions from a sentAddress filter.
const QUERY_TXS_BY_ADDRESS = `
  query QueryTxsByAddress($address: SuiAddress!) {
    transactionBlocks(
      filter: { sentAddress: $address }
      last: 20
    ) {
      nodes {
        digest
      }
    }
  }
`;

const QUERY_TX_INPUT = `
  query GetTxInput($digest: String!) {
    transaction(digest: $digest) {
      transactionBcs
    }
  }
`;

export const Sign = () => {
  const [searchParams] = useSearchParams();
  const { requestDecryption, pinModal } = usePinPrompt();
  const ephemeralAddress = searchParams.get('q');

  const currentAccount = useCurrentAccount();
  const dAppKit = useDAppKit();

  const [deployedUrl, setDeployedUrl] = useState<string | undefined>(undefined);
  const [statusText, setStatusText] = useState<string>(
    'Initializing signer...',
  );
  const keypairRef = useRef<Ed25519Keypair | undefined>(undefined);
  const lastKnownDigestRef = useRef<string | undefined>(undefined);
  const pinRef = useRef<string | undefined>(undefined);
  const hasFiredRef = useRef(false);

  const sleep = (ms = 2500) => new Promise((r) => setTimeout(r, ms));

  // Query the latest transaction digest from the ephemeral address using GraphQL.
  const pollLatestTransaction = async (): Promise<string | null> => {
    if (!ephemeralAddress) return null;

    const r = await gqlClient.query<
      {
        transactionBlocks: {
          nodes: { digest: string }[];
        };
      },
      { address: string }
    >({
      query: QUERY_TXS_BY_ADDRESS,
      variables: { address: ephemeralAddress },
    });

    // Check errors before data per policy.
    if (r.errors?.length) {
      console.error('[poll][graphql] errors:', r.errors);
      return null;
    }

    const nodes = r.data?.transactionBlocks?.nodes ?? [];
    if (nodes.length === 0) return null;

    const latest = nodes[nodes.length - 1];

    if (
      !lastKnownDigestRef.current ||
      latest.digest !== lastKnownDigestRef.current
    ) {
      return latest.digest;
    }

    return null;
  };

  // Two-stage loader for fetching the transaction input BCS.
  // Stage 1: gRPC getTransaction; Stage 2: GraphQL fallback.
  const fetchTxInput = async (digest: string): Promise<Uint8Array> => {
    let grpcReason: unknown = 'miss';

    // Stage 1: gRPC
    try {
      const result = await grpcClient.getTransaction({
        digest,
        include: { bcs: true },
      });
      const tx =
        result.$kind === 'Transaction'
          ? result.Transaction
          : result.FailedTransaction;
      if (tx.bcs instanceof Uint8Array && tx.bcs.length > 0) {
        return tx.bcs;
      }
      grpcReason = 'empty bcs';
    } catch (e) {
      grpcReason = e;
    }

    // Stage 2: GraphQL fallback
    const r = await gqlClient.query<
      { transaction: { transactionBcs: string } | null },
      { digest: string }
    >({
      query: QUERY_TX_INPUT,
      variables: { digest },
    });

    // Check errors before data per policy.
    if (r.errors?.length) {
      throw new Error(
        `[loader][graphql] errors (network=${SIGN_NETWORK}, stage=graphql, digest=${digest}): ${JSON.stringify(r.errors)}`,
      );
    }

    const bcs64 = r.data?.transaction?.transactionBcs;
    if (!bcs64) {
      throw new Error(
        `[loader] transaction not found/pruned (network=${SIGN_NETWORK}, digest=${digest}) after grpc->graphql fallback; grpc=${String(grpcReason)}, graphql=null`,
      );
    }

    return fromBase64(bcs64);
  };

  const handleIncomingDigest = async ({
    digest,
  }: {
    digest: string;
  }): Promise<Payload> => {
    try {
      // Fetch raw BCS bytes via two-stage loader.
      const bcsBytes = await fetchTxInput(digest);

      // Parse the transaction to extract input data.
      // Skip 4-byte envelope prefix to get TransactionData bytes.
      const txObj = Transaction.from(toBase64(bcsBytes.slice(4)));
      const txData = txObj.getData();

      // In Sui 2.x, getData() returns inputs and commands directly (no ProgrammableTransaction wrapper).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inputs: unknown[] = (txData as any).inputs ?? [];

      if (inputs.length === 0) {
        throw new Error('Invalid transaction input structure.');
      }

      // First input is a pure bool flag.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const firstInput = inputs[0] as any;
      if (firstInput.$kind !== 'Pure') {
        throw new Error(
          'Invalid transaction input structure: first input not Pure.',
        );
      }

      const firstBytes = new Uint8Array(firstInput.Pure.bytes);
      if (!bcs.bool().parse(firstBytes)) {
        throw new Error('self signed transaction not allowed');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const encryptedChunks: Uint8Array[] = (inputs.slice(1) as any[])
        .filter((input) => input.$kind === 'Pure')
        .map((input) => new Uint8Array(input.Pure.bytes));

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

    // Post-submit confirmation: gRPC signAndExecuteTransaction + waitForTransaction.
    const result = await grpcClient.signAndExecuteTransaction({
      transaction: await tx.build({ client: grpcClient }),
      signer: ephemeralKeypair,
    });

    const digest =
      result.$kind === 'Transaction'
        ? result.Transaction.digest
        : result.FailedTransaction.digest;

    await grpcClient.waitForTransaction({ digest });
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
                  // dapp-kit-react: use dAppKit.signTransaction directly (no hook).
                  const { signature } = await dAppKit.signTransaction({
                    transaction: await Transaction.from(
                      fromBase64(payload.bytes),
                    ).toJSON(),
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
                  // dapp-kit-react: use dAppKit.signPersonalMessage directly (no hook).
                  const { signature } = await dAppKit.signPersonalMessage({
                    message: fromBase64(payload.bytes),
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
        const r = await gqlClient.query<
          {
            transactionBlocks: {
              nodes: { digest: string }[];
            };
          },
          { address: string }
        >({
          query: QUERY_TXS_BY_ADDRESS,
          variables: { address: ephemeralAddress },
        });

        if (r.errors?.length) {
          console.error('[init][graphql] errors:', r.errors);
          await sleep();
          continue;
        }

        const data = r.data?.transactionBlocks?.nodes ?? [];

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
              // dapp-kit-react: use dAppKit.signPersonalMessage directly.
              const { signature } = await dAppKit.signPersonalMessage({
                message: new TextEncoder().encode(
                  toBase64(sha256(fromBase64(payload.bytes))),
                ),
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
        } else {
          await sleep();
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
