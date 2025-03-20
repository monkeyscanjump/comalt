import React from 'react';
import { useAuth } from '@/contexts/auth';
import styles from '@/components/auth/AuthComponents.module.css';
import { getPublicEnv } from '@/utils/env';

interface ConnectWalletProps {
  showTitle?: boolean;
}

export function ConnectWallet({ showTitle = true }: ConnectWalletProps) {
  const { connect, resetRejectionState } = useAuth();

  const handleConnect = async () => {
    try {
      resetRejectionState();
      await connect();
    } catch (error) {
      // Silent error handling
    }
  };

  return (
    <div className={styles.connectContainer}>
      {showTitle && <h2>{getPublicEnv('APP_NAME', 'comAlt')}</h2>}
      <p>Please connect your wallet to use this app.</p>
      <button onClick={handleConnect} className={styles.primaryButton}>
        Connect Wallet
      </button>
    </div>
  );
}
