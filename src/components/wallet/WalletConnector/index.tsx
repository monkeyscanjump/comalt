"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth';
import { config } from '@/config';
import styles from './WalletConnector.module.css';
import AccountSelector from '@/components/wallet/AccountSelector';

/**
 * WalletConnector component handles wallet connection state display.
 * Manages connection/disconnection and displays wallet information.
 * Includes persistence for wallet name across page refreshes.
 */
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

  // Local state for persisting wallet name
  const [persistentName, setPersistentName] = useState<string | null>(null);

  /**
   * Effect for managing wallet name persistence
   * Preserves name across page refreshes using localStorage
   */
  useEffect(() => {
    if (selectedAccount?.meta?.name) {
      // When account is selected, save name
      setPersistentName(selectedAccount.meta.name);
      localStorage.setItem(config.auth.walletName, selectedAccount.meta.name);
    }
    else if (walletAddress && !persistentName) {
      // On page refresh, try to restore from localStorage
      const storedName = localStorage.getItem(config.auth.walletName);
      if (storedName) {
        setPersistentName(storedName);
      }
    }
    else if (!walletAddress && !selectedAccount) {
      // Clear on disconnect
      setPersistentName(null);
    }
  }, [selectedAccount, walletAddress, persistentName]);

  /**
   * Handles wallet connection/disconnection
   */
  const handleButtonClick = () => {
    if (isWalletConnected || selectedAccount) {
      logout();
      // Also clear persistent name
      setPersistentName(null);
      localStorage.removeItem(config.auth.walletName);
    } else {
      connect();
    }
  };

  /**
   * Determine display name with fallback mechanisms
   * - First try from selectedAccount
   * - Then from persistent storage
   * - Finally fallback to "Wallet"
   */
  const displayName = selectedAccount?.meta?.name || persistentName || (isWalletConnected ? 'Wallet' : '');

  /**
   * Generate shortened address for display
   */
  const shortAddress = selectedAccount
    ? `...${selectedAccount.address.slice(-6)}`
    : (walletAddress ? `...${walletAddress.slice(-6)}` : '');

  /**
   * Get button styling based on connection state
   */
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
          data-testid="connect-button"
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        // Connected state button
        <button
          className={getButtonClasses()}
          onClick={handleButtonClick}
          title={error ? error : 'Click to disconnect'}
          data-testid="wallet-button"
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
