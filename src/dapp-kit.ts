import { createDAppKit } from '@mysten/dapp-kit-react';

import { createGrpcClient } from './utils/suiClient';

export const dAppKit = createDAppKit({
  networks: ['mainnet'] as const,
  createClient: (network) => createGrpcClient(network),
});

// Register for TypeScript autocomplete
declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
