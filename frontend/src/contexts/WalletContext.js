import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

const WalletContext = createContext(null);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  // Wallet connection mode: 'connect' or 'monitor'
  const [walletMode, setWalletMode] = useState(() => {
    return localStorage.getItem('walletMode') || 'connect';
  });

  // Manual address for monitoring mode
  const [monitorAddress, setMonitorAddress] = useState(() => {
    return localStorage.getItem('monitorAddress') || '';
  });

  // Network endpoint
  const endpoint = useMemo(() => clusterApiUrl('mainnet-beta'), []);

  // Available wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  // Save wallet mode preference
  useEffect(() => {
    localStorage.setItem('walletMode', walletMode);
  }, [walletMode]);

  // Save monitor address
  useEffect(() => {
    if (monitorAddress) {
      localStorage.setItem('monitorAddress', monitorAddress);
    } else {
      localStorage.removeItem('monitorAddress');
    }
  }, [monitorAddress]);

  const switchToConnectMode = () => {
    setWalletMode('connect');
    setMonitorAddress('');
  };

  const switchToMonitorMode = (address) => {
    setWalletMode('monitor');
    setMonitorAddress(address);
  };

  const clearMonitorAddress = () => {
    setMonitorAddress('');
  };

  const value = {
    walletMode,
    monitorAddress,
    switchToConnectMode,
    switchToMonitorMode,
    clearMonitorAddress,
  };

  return (
    <WalletContext.Provider value={value}>
      <ConnectionProvider endpoint={endpoint}>
        <SolanaWalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider
            className="wallet-adapter-modal-custom"
            style={{ zIndex: 99999 }}
          >
            {children}
          </WalletModalProvider>
        </SolanaWalletProvider>
      </ConnectionProvider>
    </WalletContext.Provider>
  );
};

export default WalletContext;
