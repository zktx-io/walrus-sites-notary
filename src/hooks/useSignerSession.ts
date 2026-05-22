import type { IntentScope } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';
import { useEffect, useRef, useState } from 'react';

import {
  assertPayloadMatchesWallet,
  decryptSignPayload,
  extractEncryptedRequestFromBcs,
  getInitialHandshakeMessage,
  getPersonalMessageText,
  parseKeyPayload,
  type SignPayload,
} from '../utils/signPayload';
import {
  fetchTransportTxBcs,
  getLatestTransportTransactions,
  getTransportMessageKind,
  getTransportTransactionPage,
  sendEncryptedResponse,
  SIGN_TRANSPORT_TX_PAGE_SIZE,
  type TransportTransactionSummary,
} from '../utils/signTransport';

type SignerSessionPhase =
  | 'idle'
  | 'restore_key'
  | 'sync_latest'
  | 'waiting'
  | 'signing'
  | 'responding'
  | 'complete'
  | 'error';

interface WalletSigner {
  signTransaction(args: { transaction: Transaction | string }): Promise<{
    signature: string;
  }>;
  signPersonalMessage(args: { message: Uint8Array }): Promise<{
    signature: string;
  }>;
}

interface UseSignerSessionArgs {
  ephemeralAddress: string | null;
  walletAddress?: string;
  dAppKit: WalletSigner;
  requestDecryption: (data: Uint8Array) => Promise<string>;
}

interface UseSignerSessionResult {
  deployedUrl?: string;
  phase: SignerSessionPhase;
  statusText: string;
}

interface RecoveredKeypair {
  digest: string;
  keypair: Ed25519Keypair;
  payload: SignPayload;
}

interface PersistedSignerSession {
  version: 1;
  handledRequestDigests: string[];
  lastHandledRequestDigest?: string;
  lastResponseDigest?: string;
}

const emptyPersistedSession = (): PersistedSignerSession => ({
  version: 1,
  handledRequestDigests: [],
});

const sleep = (ms = 2500) => new Promise((r) => setTimeout(r, ms));

const getSessionStorageKey = (ephemeralAddress: string) =>
  `walrus-sites-notary:sign-session:${ephemeralAddress}`;

const isPersistedSignerSession = (
  value: unknown,
): value is PersistedSignerSession => {
  const session = value as Partial<PersistedSignerSession>;
  return (
    session.version === 1 &&
    Array.isArray(session.handledRequestDigests) &&
    session.handledRequestDigests.every((digest) => typeof digest === 'string')
  );
};

const loadPersistedSession = (
  ephemeralAddress: string | null,
): PersistedSignerSession => {
  if (!ephemeralAddress) return emptyPersistedSession();
  try {
    const raw = sessionStorage.getItem(getSessionStorageKey(ephemeralAddress));
    if (!raw) return emptyPersistedSession();
    const parsed = JSON.parse(raw) as unknown;
    return isPersistedSignerSession(parsed)
      ? parsed
      : emptyPersistedSession();
  } catch {
    return emptyPersistedSession();
  }
};

const savePersistedSession = (
  ephemeralAddress: string | null,
  session: PersistedSignerSession,
) => {
  if (!ephemeralAddress) return;
  try {
    sessionStorage.setItem(
      getSessionStorageKey(ephemeralAddress),
      JSON.stringify({
        ...session,
        handledRequestDigests: session.handledRequestDigests.slice(-200),
      }),
    );
  } catch {
    // sessionStorage is an optimization for refresh recovery.
  }
};

const latestTransaction = (
  transactions: TransportTransactionSummary[],
): TransportTransactionSummary | undefined =>
  transactions[transactions.length - 1];

const getDigestListKey = (transactions: TransportTransactionSummary[]) =>
  transactions.map((tx) => tx.digest).join(':');

const errorStatus = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('Modal closed')) return 'PIN entry cancelled.';
  if (message.includes('address does not match')) {
    return 'Connected wallet does not match signing request.';
  }
  if (message.includes('Unsupported signing network')) {
    return 'Signing request is for an unsupported network.';
  }
  if (message.includes('Signed response transaction failed')) {
    return 'Signed response transaction failed on devnet.';
  }
  if (message.toLowerCase().includes('reject')) {
    return 'Wallet signing was rejected.';
  }
  return 'Signing request failed.';
};

export const useSignerSession = ({
  ephemeralAddress,
  walletAddress,
  dAppKit,
  requestDecryption,
}: UseSignerSessionArgs): UseSignerSessionResult => {
  const [phase, setPhase] = useState<SignerSessionPhase>('idle');
  const [statusText, setStatusText] = useState('Initializing signer...');
  const [deployedUrl, setDeployedUrl] = useState<string | undefined>();
  const [ephemeralKeypair, setEphemeralKeypair] = useState<
    Ed25519Keypair | undefined
  >();

  const keypairRef = useRef<Ed25519Keypair | undefined>(undefined);
  const pinRef = useRef<string | undefined>(undefined);
  const processedRequestDigestsRef = useRef<Set<string>>(new Set());
  const persistedSessionRef = useRef<PersistedSignerSession>(
    emptyPersistedSession(),
  );
  const seenTransportDigestListRef = useRef('');
  const blockedRequestDigestRef = useRef<string | undefined>(undefined);
  const lastHandledRequestDigestRef = useRef<string | undefined>(undefined);
  const lastResponseDigestRef = useRef<string | undefined>(undefined);
  const completedRef = useRef(false);

  const setSessionStatus = (nextPhase: SignerSessionPhase, text: string) => {
    setPhase(nextPhase);
    setStatusText(text);
  };

  const persistSession = () => {
    savePersistedSession(ephemeralAddress, persistedSessionRef.current);
  };

  const recordHandledRequest = (
    requestDigest: string,
    responseDigest?: string,
  ) => {
    processedRequestDigestsRef.current.add(requestDigest);
    lastHandledRequestDigestRef.current = requestDigest;
    if (responseDigest) {
      lastResponseDigestRef.current = responseDigest;
    }

    const handled = new Set(persistedSessionRef.current.handledRequestDigests);
    handled.add(requestDigest);
    persistedSessionRef.current = {
      version: 1,
      handledRequestDigests: [...handled].slice(-200),
      lastHandledRequestDigest: requestDigest,
      lastResponseDigest:
        responseDigest ?? persistedSessionRef.current.lastResponseDigest,
    };
    persistSession();
  };

  const markHandledRequests = async (
    transactions: TransportTransactionSummary[],
    exceptDigest?: string,
  ) => {
    for (const { digest } of transactions) {
      if (digest === exceptDigest) continue;
      if ((await getTransportMessageKind(digest)) === 'request') {
        recordHandledRequest(digest);
      }
    }
  };

  const readPayloadFromDigest = async (
    digest: string,
  ): Promise<SignPayload> => {
    if (!walletAddress) {
      throw new Error('Wallet is not connected.');
    }

    const encrypted = extractEncryptedRequestFromBcs(
      await fetchTransportTxBcs(digest),
    );
    const resolvedPin =
      pinRef.current || (await requestDecryption(encrypted));
    pinRef.current = resolvedPin;

    const payload = await decryptSignPayload(encrypted, resolvedPin);
    assertPayloadMatchesWallet(payload, walletAddress);
    return payload;
  };

  const recoverKeypairFromHistory = async (
    address: string,
  ): Promise<RecoveredKeypair | null> => {
    let cursor: string | null = null;
    const seenCursors = new Set<string>();

    while (true) {
      const { transactions, pageInfo } = await getTransportTransactionPage({
        address,
        first: SIGN_TRANSPORT_TX_PAGE_SIZE,
        after: cursor,
      });

      for (const { digest } of transactions) {
        if ((await getTransportMessageKind(digest)) !== 'request') continue;

        const payload = await readPayloadFromDigest(digest);
        const keyPayload = parseKeyPayload(payload);
        if (keyPayload) {
          return {
            digest,
            keypair: Ed25519Keypair.fromSecretKey(keyPayload.secretKey),
            payload,
          };
        }
      }

      if (!pageInfo.hasNextPage || !pageInfo.endCursor) break;
      if (seenCursors.has(pageInfo.endCursor)) break;
      seenCursors.add(pageInfo.endCursor);
      cursor = pageInfo.endCursor;
    }

    return null;
  };

  const findPendingLatestRequest = async (): Promise<string | null> => {
    if (!ephemeralAddress) return null;

    const transactions = await getLatestTransportTransactions(ephemeralAddress);
    const digestListKey = getDigestListKey(transactions);
    if (digestListKey !== seenTransportDigestListRef.current) {
      seenTransportDigestListRef.current = digestListKey;
      blockedRequestDigestRef.current = undefined;
    }

    const latest = latestTransaction(transactions);
    if (!latest) return null;
    if (blockedRequestDigestRef.current === latest.digest) return null;
    if (processedRequestDigestsRef.current.has(latest.digest)) return null;

    return (await getTransportMessageKind(latest.digest)) === 'request'
      ? latest.digest
      : null;
  };

  const sendResponseForPayload = async (
    keypair: Ed25519Keypair,
    requestDigest: string,
    intent: IntentScope,
    signature: string,
  ) => {
    if (!ephemeralAddress || !pinRef.current) {
      throw new Error('Cannot send signed response without signer context.');
    }

    setSessionStatus('responding', 'Sending signed response...');
    const responseDigest = await sendEncryptedResponse({
      ephemeralAddress,
      ephemeralKeypair: keypair,
      pin: pinRef.current,
      response: { intent, signature },
    });
    recordHandledRequest(requestDigest, responseDigest);
  };

  const processRequest = async (
    keypair: Ed25519Keypair,
    digest: string,
  ) => {
    try {
      setSessionStatus('signing', 'Signing request...');
      const payload = await readPayloadFromDigest(digest);

      switch (payload.intent) {
        case 'TransactionData': {
          const { signature } = await dAppKit.signTransaction({
            transaction: await Transaction.from(
              fromBase64(payload.bytes),
            ).toJSON(),
          });
          await sendResponseForPayload(
            keypair,
            digest,
            payload.intent,
            signature,
          );
          break;
        }

        case 'PersonalMessage': {
          const messageText = getPersonalMessageText(payload);
          if (messageText.startsWith('{"url":"')) {
            const { url } = JSON.parse(messageText) as { url: string };
            setDeployedUrl(url);
            recordHandledRequest(digest);
            completedRef.current = true;
            setSessionStatus('complete', 'Deployment complete.');
            return;
          }

          const { signature } = await dAppKit.signPersonalMessage({
            message: fromBase64(payload.bytes),
          });
          await sendResponseForPayload(
            keypair,
            digest,
            payload.intent,
            signature,
          );
          break;
        }

        default:
          throw new Error(`Unsupported signing intent: ${payload.intent}`);
      }
    } catch (error) {
      blockedRequestDigestRef.current = digest;
      setSessionStatus('error', errorStatus(error));
    }
  };

  useEffect(() => {
    const persistedSession = loadPersistedSession(ephemeralAddress);
    persistedSessionRef.current = persistedSession;
    processedRequestDigestsRef.current = new Set(
      persistedSession.handledRequestDigests,
    );
    lastHandledRequestDigestRef.current =
      persistedSession.lastHandledRequestDigest;
    lastResponseDigestRef.current = persistedSession.lastResponseDigest;
    seenTransportDigestListRef.current = '';
    blockedRequestDigestRef.current = undefined;
    completedRef.current = false;
    keypairRef.current = undefined;
    pinRef.current = undefined;
    setEphemeralKeypair(undefined);
    setDeployedUrl(undefined);
    setSessionStatus('idle', 'Initializing signer...');
  }, [ephemeralAddress, walletAddress]);

  useEffect(() => {
    if (!ephemeralAddress || !walletAddress || keypairRef.current) return;

    let stop = false;

    const init = async () => {
      while (!stop && !keypairRef.current) {
        try {
          setSessionStatus('restore_key', 'Restoring signer key...');
          const recovered = await recoverKeypairFromHistory(ephemeralAddress);
          if (!recovered) {
            setSessionStatus(
              'restore_key',
              'Waiting for initial signing request...',
            );
            await sleep();
            continue;
          }

          setSessionStatus('sync_latest', 'Syncing signing requests...');
          const transactions =
            await getLatestTransportTransactions(ephemeralAddress);
          const digestListKey = getDigestListKey(transactions);
          seenTransportDigestListRef.current = digestListKey;

          const latest = latestTransaction(transactions);
          const latestKind = latest
            ? await getTransportMessageKind(latest.digest)
            : null;

          if (
            latest?.digest === recovered.digest &&
            latestKind === 'request' &&
            !processedRequestDigestsRef.current.has(recovered.digest)
          ) {
            setSessionStatus('signing', 'Signing initial request...');
            const { signature } = await dAppKit.signPersonalMessage({
              message: getInitialHandshakeMessage(recovered.payload),
            });
            await sendResponseForPayload(
              recovered.keypair,
              recovered.digest,
              recovered.payload.intent,
              signature,
            );
          } else {
            await markHandledRequests(
              transactions,
              latestKind === 'request' ? latest?.digest : undefined,
            );
            setSessionStatus('waiting', 'Waiting for signing requests...');
          }

          keypairRef.current = recovered.keypair;
          setEphemeralKeypair(recovered.keypair);
        } catch (error) {
          keypairRef.current = undefined;
          setSessionStatus('error', errorStatus(error));
          await sleep();
        }
      }
    };

    init();

    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ephemeralAddress, walletAddress]);

  useEffect(() => {
    if (!ephemeralAddress || !walletAddress || !ephemeralKeypair) return;

    let stop = false;

    const monitorRequests = async (keypair: Ed25519Keypair) => {
      while (!stop && !completedRef.current) {
        try {
          const digest = await findPendingLatestRequest();
          if (digest) {
            await processRequest(keypair, digest);
          } else if (!blockedRequestDigestRef.current) {
            setSessionStatus('waiting', 'Waiting for signing requests...');
          }
        } catch {
          if (!blockedRequestDigestRef.current) {
            setSessionStatus('waiting', 'Waiting for signing requests...');
          }
        }
        await sleep();
      }
    };

    monitorRequests(ephemeralKeypair);

    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ephemeralAddress, walletAddress, ephemeralKeypair]);

  return {
    deployedUrl,
    phase,
    statusText,
  };
};
