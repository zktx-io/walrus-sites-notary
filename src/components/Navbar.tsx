import {
  ConnectModal,
  useCurrentAccount,
  useDisconnectWallet,
} from '@mysten/dapp-kit';
import { Github, BookOpen, Info, Wallet, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { Search } from './Search';

export const Navbar = ({ showInput = false }: { showInput?: boolean }) => {
  const currentAccount = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const [open, setOpen] = useState(false);

  return (
    <nav className="w-full h-16 px-4 fixed top-0 z-[1000] backdrop-blur-md bg-black/5 shadow-sm">
      <div className="flex justify-between items-center h-full max-w-7xl mx-auto w-full">
        <RouterLink
          to="/"
          className="flex items-center text-white text-lg font-semibold"
        >
          <span className="text-green-400 block sm:hidden">notary</span>
          <span className="text-green-400 hidden sm:block">
            notary<span className="text-white">.wal.app</span>
          </span>
        </RouterLink>

        {showInput ? (
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <Search />
            <a
              href="https://github.com/zktx-io/walrus-sites-provenance"
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              title="GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="https://docs.walrus.site"
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              title="Walrus Docs"
            >
              <BookOpen className="w-5 h-5" />
            </a>
            <a
              href="https://docs.zktx.io"
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              title="zktx.io"
            >
              <Info className="w-5 h-5" />
            </a>
            {currentAccount ? (
              <button
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-white"
                title={currentAccount.address}
                onClick={() => disconnect()}
              >
                <LogOut className="w-5 h-5" />
              </button>
            ) : (
              <ConnectModal
                trigger={
                  <button className="p-2 rounded-full hover:bg-white/10 transition-colors text-white">
                    <Wallet className="w-5 h-5" />
                  </button>
                }
                open={open}
                onOpenChange={(isOpen) => setOpen(isOpen)}
              />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <div className="flex items-center gap-2 sm:gap-4 text-sm text-gray-300">
              <a
                href="https://github.com/zktx-io/walrus-sites-provenance"
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                title="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="https://docs.walrus.site"
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                title="Walrus Docs"
              >
                <BookOpen className="w-5 h-5" />
              </a>
              <a
                href="https://docs.zktx.io"
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                title="zktx.io"
              >
                <Info className="w-5 h-5" />
              </a>
              {currentAccount ? (
                <button
                  className="p-2 rounded-full hover:bg-white/10 transition-colors text-white"
                  title={currentAccount.address}
                  onClick={() => disconnect()}
                >
                  <LogOut className="w-5 h-5" />
                </button>
              ) : (
                <ConnectModal
                  trigger={
                    <button className="p-2 rounded-full hover:bg-white/10 transition-colors text-white">
                      <Wallet className="w-5 h-5" />
                    </button>
                  }
                  open={open}
                  onOpenChange={(isOpen) => setOpen(isOpen)}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
