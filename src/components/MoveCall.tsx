import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Package, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';

import { MoveCallForm } from './MoveCallForm';

export const MoveCall = ({
  address,
  params,
}: {
  address: string;
  params: {
    [pkg: string]: { name: string; params: { name: string; type: string }[] }[];
  };
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [modal, setModal] = useState<{
    status: 'success' | 'error' | null;
    message?: string;
  } | null>(null);

  const account = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } =
    useSignAndExecuteTransaction();

  const handleExcute = async (
    pkg: string,
    fnName: string,
    params: { type: string; value: string }[],
  ) => {
    setIsRunning(true);
    const target = `${address}::${pkg.split('::')[1]}::${fnName}`;
    if (!account) return;
    try {
      console.log(`Running ${target}...`);

      const transaction = new Transaction();
      transaction.setSender(account.address);

      const args = params
        .map(({ type, value }) => {
          switch (type) {
            case 'u8':
              return transaction.pure.u8(parseInt(value));
            case 'u16':
              return transaction.pure.u16(parseInt(value));
            case 'u32':
              return transaction.pure.u32(parseInt(value));
            case 'u64':
              return transaction.pure.u64(value);
            case 'u128':
              return transaction.pure.u128(value);
            case 'u256':
              return transaction.pure.u256(value);
            case 'Bool':
              return transaction.pure.bool(value === 'true');
            case 'Address':
              return transaction.pure.address(value);
            case 'string::String':
              return transaction.pure.string(value);
            default:
              return undefined;
          }
        })
        .filter((arg) => arg !== undefined);

      transaction.moveCall({
        target,
        arguments: args,
      });
      const { digest } = await signAndExecuteTransaction({
        chain: `sui:mainnet`, // TODO:
        transaction: await transaction.toJSON(),
      });

      console.log(digest);
      setModal({ status: 'success', message: `Executed ${target}` });
    } catch (err) {
      console.error(`Error running ${target}...`, err);
      setModal({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {Object.entries(params).map(([pkg, functions]) => (
        <div
          key={pkg}
          className="p-4 rounded-lg border border-white/10 bg-white/5 backdrop-blur-md"
        >
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-white" />
            <span>
              Package: <span className="text-blue-300">{pkg}</span>
            </span>
          </h2>

          <div className="space-y-4">
            {functions.map((fn) => (
              <MoveCallForm
                key={fn.name}
                fn={fn}
                isRunning={isRunning}
                onExcute={(args) => handleExcute(pkg, fn.name, args)}
              />
            ))}
          </div>
        </div>
      ))}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-xl w-[320px]">
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
              {modal.status === 'success' ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Success</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-500" />
                  <span>Failed</span>
                </>
              )}
            </h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 break-all">
              {modal.message}
            </p>
            <button
              onClick={() => setModal(null)}
              className="px-3 py-1 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
