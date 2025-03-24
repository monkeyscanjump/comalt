import React from 'react';
import { useAuth } from '@/contexts/auth';
import styles from '@/components/auth/AuthComponents.module.css';
import { FaWallet } from 'react-icons/fa';

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
    <div className={styles.authContainer}>
      {showTitle && (
        <h2 className={styles.authTitle}>
          <FaWallet className={styles.titleIcon} />
          Connect Your Wallet
        </h2>
      )}

      <p className={styles.authDescription}>
        Please connect your wallet to use this application. Your wallet will be used for authentication.
      </p>

      <button onClick={handleConnect} className={styles.primaryButton}>
        <FaWallet className={styles.buttonIcon} />
        Connect Wallet
      </button>
    </div>
  );
}
