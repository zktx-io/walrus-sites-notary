import { bcs } from '@mysten/sui/bcs';
import type { IntentScope } from '@mysten/sui/cryptography';
import { Transaction } from '@mysten/sui/transactions';
import {
  fromBase64,
  isValidSuiAddress,
  normalizeSuiAddress,
  toBase64,
} from '@mysten/sui/utils';
import { sha256 } from '@noble/hashes/sha256';

import { decryptBytes } from './gitSigner';
import { APP_NETWORK, type Network } from './suiClient';

export interface SignPayload {
  intent: IntentScope;
  network: Network;
  address: string;
  bytes: string;
}

export interface KeyPayload {
  secretKey: string;
}

interface SignTransactionInput {
  $kind?: string;
  Pure?: {
    bytes?: string;
  };
}

interface SignTransactionArgument {
  $kind?: string;
  Input?: number;
}

interface SignTransactionCommand {
  $kind?: string;
  TransferObjects?: {
    address?: SignTransactionArgument;
  };
}

interface ParsedTransactionData {
  inputs?: unknown[];
  commands?: unknown[];
}

const inputIndexFromArgument = (
  argument: SignTransactionArgument | undefined,
): number | undefined =>
  argument?.$kind === 'Input' && typeof argument.Input === 'number'
    ? argument.Input
    : undefined;

const getTransferRecipientInputIndexes = (
  commands: SignTransactionCommand[],
): Set<number> => {
  const indexes = new Set<number>();

  for (const command of commands) {
    if (command.$kind !== 'TransferObjects') continue;
    const inputIndex = inputIndexFromArgument(command.TransferObjects?.address);
    if (inputIndex !== undefined) {
      indexes.add(inputIndex);
    }
  }

  return indexes;
};

const isSignPayload = (value: unknown): value is SignPayload => {
  const payload = value as Partial<SignPayload>;
  return (
    typeof payload.intent === 'string' &&
    typeof payload.network === 'string' &&
    typeof payload.address === 'string' &&
    typeof payload.bytes === 'string'
  );
};

export const extractEncryptedRequestFromBcs = (
  bcsBytes: Uint8Array,
): Uint8Array => {
  const txObj = Transaction.from(bcsBytes);
  const txData = txObj.getData() as ParsedTransactionData;
  const inputs = Array.isArray(txData.inputs) ? txData.inputs : [];
  const commands = (
    Array.isArray(txData.commands) ? txData.commands : []
  ) as SignTransactionCommand[];
  const transferRecipientInputIndexes =
    getTransferRecipientInputIndexes(commands);

  if (inputs.length === 0) {
    throw new Error('Invalid transaction input structure.');
  }

  const firstInput = inputs[0] as SignTransactionInput;
  if (firstInput.$kind !== 'Pure' || !firstInput.Pure?.bytes) {
    throw new Error('Invalid transaction input structure: first input not Pure.');
  }

  if (!bcs.bool().parse(fromBase64(firstInput.Pure.bytes))) {
    throw new Error('Response transaction cannot be handled as a request.');
  }

  const parsedChunks: Uint8Array[] = [];
  for (const [relativeIndex, input] of (
    inputs.slice(1) as SignTransactionInput[]
  ).entries()) {
    const inputIndex = relativeIndex + 1;
    if (input.$kind !== 'Pure' || !input.Pure?.bytes) continue;
    if (transferRecipientInputIndexes.has(inputIndex)) continue;

    const pureBytes = fromBase64(input.Pure.bytes);
    try {
      parsedChunks.push(new Uint8Array(bcs.vector(bcs.u8()).parse(pureBytes)));
    } catch {
      // Non-vector Pure inputs are transaction arguments, not encrypted data.
    }
  }

  if (parsedChunks.length < 1) {
    throw new Error('Invalid encrypted structure or missing request payload.');
  }

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

  return fullEncrypted;
};

export const decryptSignPayload = async (
  encrypted: Uint8Array,
  pin: string,
): Promise<SignPayload> => {
  const decrypted = await decryptBytes(encrypted, pin);
  const parsed = JSON.parse(new TextDecoder().decode(decrypted)) as unknown;
  if (!isSignPayload(parsed)) {
    throw new Error('Invalid signing payload.');
  }
  if (parsed.network !== APP_NETWORK) {
    throw new Error(`Unsupported signing network: ${parsed.network}`);
  }
  return parsed;
};

export const parseKeyPayload = (payload: SignPayload): KeyPayload | null => {
  try {
    const parsed = JSON.parse(
      new TextDecoder().decode(fromBase64(payload.bytes)),
    ) as Partial<KeyPayload>;
    return typeof parsed.secretKey === 'string'
      ? { secretKey: parsed.secretKey }
      : null;
  } catch {
    return null;
  }
};

export const assertPayloadMatchesWallet = (
  payload: SignPayload,
  walletAddress: string,
) => {
  const payloadAddress = normalizeSuiAddress(payload.address);
  const normalizedWalletAddress = normalizeSuiAddress(walletAddress);
  if (
    !isValidSuiAddress(payloadAddress) ||
    payloadAddress !== normalizedWalletAddress
  ) {
    throw new Error('Signing payload address does not match connected wallet.');
  }
};

export const getInitialHandshakeMessage = (payload: SignPayload): Uint8Array =>
  new TextEncoder().encode(toBase64(sha256(fromBase64(payload.bytes))));

export const getPersonalMessageText = (payload: SignPayload): string =>
  new TextDecoder().decode(fromBase64(payload.bytes));
