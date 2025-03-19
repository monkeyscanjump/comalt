"use client";

import React from 'react';
import { useAuth } from '@/contexts/auth';
import styles from './WalletConnector.module.css';
import AccountSelector from './AccountSelector';

const WalletConnector = () => {
  const {
    selectedAccount,
    isConnecting,
    connect,
    logout,
    error,
    showAccountSelector,
    isWalletConnected,
    walletAddress
  } = useAuth();

  // Simple connect/disconnect handler
  const handleButtonClick = () => {
    if (isWalletConnected || selectedAccount) {
      logout();
    } else {
      connect();
    }
  };

  // Extract display name and shortened address
  const displayName = selectedAccount ?
    (selectedAccount.meta?.name || 'Wallet') : '';

  const shortAddress = selectedAccount ?
    `...${selectedAccount.address.slice(-6)}` :
    (walletAddress ? `...${walletAddress.slice(-6)}` : '');

  // Create the button class using CSS module styles
  const getButtonClasses = () => {
    let classes = styles['wallet-button'];

    if (error) {
      classes += ` ${styles['wallet-button-error']}`;
    } else if (isWalletConnected || selectedAccount) {
      classes += ` ${styles['wallet-button-connected']}`;
    } else {
      classes += ` ${styles['wallet-button-connect']}`;
    }

    if (isConnecting) {
      classes += ` ${styles['connect-loading']}`;
    }

    return classes;
  };

  return (
    <div className={styles['wallet-connector']}>
      {!isWalletConnected && !selectedAccount ? (
        // Disconnected state button
        <button
          onClick={handleButtonClick}
          disabled={isConnecting}
          className={getButtonClasses()}
          title={error || 'Connect to wallet'}
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        // Connected state button
        <button
          className={getButtonClasses()}
          onClick={handleButtonClick}
          title={error ? error : 'Click to disconnect'}
        >
          <span className={styles['wallet-name']}>{displayName}</span>
          <span className={styles['wallet-divider']}> | </span>
          <span className={styles['wallet-address']}>{shortAddress}</span>
          <span className={styles['disconnect-icon']} title="Disconnect">✕</span>
        </button>
      )}

      {showAccountSelector && <AccountSelector />}
    </div>
  );
};

export default WalletConnector;
