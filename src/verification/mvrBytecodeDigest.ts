import { fromBase64 } from '@mysten/sui/utils';
import { blake2b } from '@noble/hashes/blake2b';
import { sha256 } from '@noble/hashes/sha256';

import { JsonLPayload } from '../utils/parseJsonl';

import { DeploymentContext } from './mvrDeploymentParser';

const createDigest = (modules: string[], dependencies: string[]) => {
  const items = [];

  for (const base64 of modules) {
    const digest = blake2b(fromBase64(base64), { dkLen: 32 });
    items.push(digest);
  }

  for (const depId of dependencies) {
    const hex = depId.startsWith('0x') ? depId.slice(2) : depId;
    const bytes = new Uint8Array(
      (hex.match(/.{1,2}/g) ?? []).map((byte) => parseInt(byte, 16)),
    );
    items.push(bytes);
  }

  items.sort((a, b) => {
    for (let index = 0; index < 32; index++) {
      if (a[index] !== b[index]) return a[index] - b[index];
    }
    return 0;
  });

  const hasher = blake2b.create({ dkLen: 32 });
  for (const item of items) {
    hasher.update(item);
  }

  return hasher.digest();
};

export const createBytecodeDumpSha256 = (
  modules: string[],
  dependencies: string[],
): string => {
  const digest: number[] = Array.from(createDigest(modules, dependencies));
  const rawHash = sha256(
    `${JSON.stringify({ modules, dependencies, digest })}\n`,
  );

  return Array.from(rawHash)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const verifyDeploymentProvenanceHash = (
  deployment: Pick<DeploymentContext, 'modules' | 'dependencies'>,
  provenance: JsonLPayload,
): boolean => {
  const hashHex = createBytecodeDumpSha256(
    deployment.modules,
    deployment.dependencies,
  );

  return provenance.subject.some(
    (subject) =>
      subject.name === 'bytecode.dump.json' &&
      subject.digest.sha256 === hashHex,
  );
};
