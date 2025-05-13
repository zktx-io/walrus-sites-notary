import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, fromHex, toBase64, toHex } from '@mysten/sui/utils';
import { blake2b } from '@noble/hashes/blake2b';
import { sha256 } from '@noble/hashes/sha256';

import { JsonLPayload } from './parseJsonl';

const createDigest = (modules: string[], dependencies: string[]) => {
  const items = [];

  for (const base64 of modules) {
    const digest = blake2b(fromBase64(base64), { dkLen: 32 });
    items.push(digest);
  }

  for (const hex of dependencies) {
    const bytes = fromHex(hex);
    items.push(bytes);
  }

  items.sort((a, b) => {
    for (let i = 0; i < 32; i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
  });

  const hasher = blake2b.create({ dkLen: 32 });
  for (const item of items) {
    hasher.update(item);
  }

  return hasher.digest();
};

const verification = (
  modules: string[],
  dependencies: string[],
  provenance: JsonLPayload,
): boolean => {
  const digest: number[] = Array.from(createDigest(modules, dependencies));
  const hash = toHex(
    sha256(`${JSON.stringify({ modules, dependencies, digest })}\n`),
  );

  const match = provenance.subject.some(
    (s: { name: string; digest: { sha256: string } }) =>
      s.name === 'bytecode.dump.json' && s.digest.sha256 === hash,
  );

  return match;
};

export const verifyBytecode = async (
  packageAddress: string,
  digest: string,
  provenance: JsonLPayload,
): Promise<boolean> => {
  const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
  const receipt = await client.getTransactionBlock({
    digest,
    options: { showRawInput: true, showEffects: true },
  });

  if (!receipt.effects || !receipt.effects.created) {
    console.error('Transaction not found');
    return false;
  }

  const immutables = receipt.effects.created.find(
    (o) => o.owner === 'Immutable',
  );

  if (!immutables) {
    console.error('No immutable objects found');
    return false;
  }

  if (immutables.reference.objectId !== packageAddress) {
    console.error('Package address does not match');
    return false;
  }

  const transaction = Transaction.from(
    toBase64(fromBase64(receipt.rawTransaction!).slice(4)),
  );
  const data = transaction.getData();

  const upgrade = data.commands.find((c) => c.$kind === 'Upgrade');
  const publish = data.commands.find((c) => c.$kind === 'Publish');

  if (upgrade && upgrade.Upgrade) {
    return verification(
      upgrade.Upgrade['modules'],
      upgrade.Upgrade['dependencies'],
      provenance,
    );
  }

  if (publish && publish.Publish) {
    return verification(
      publish.Publish['modules'],
      publish.Publish['dependencies'],
      provenance,
    );
  }

  return false;
};
