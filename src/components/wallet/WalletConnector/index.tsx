"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth';
import { config } from '@/config';
import styles from './WalletConnector.module.css';
import AccountSelector from '@/components/wallet/AccountSelector';
import { FiX, FiLoader } from 'react-icons/fi';
import { FaWallet } from 'react-icons/fa';

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
    error: authError,
    showAccountSelector,
    setShowAccountSelector,
    isWalletConnected,
    walletAddress,
    isAuthenticated,
    accounts,
    selectAccount
  } = useAuth();

  // Local state for persisting wallet name
  const [persistentName, setPersistentName] = useState<string | null>(null);
  // Local error state to properly manage visibility
  const [localError, setLocalError] = useState<string | null>(null);

  // Update local error state when auth error changes
  useEffect(() => {
    setLocalError(authError);
  }, [authError]);

  // Clear error when successfully connected or authenticated
  useEffect(() => {
    if (isWalletConnected || isAuthenticated) {
      setLocalError(null);
    }
  }, [isWalletConnected, isAuthenticated]);

  // Auto-select if there's only one account
  useEffect(() => {
    if (accounts?.length === 1 && showAccountSelector) {
      // Auto-select the only account and hide selector
      selectAccount(accounts[0]);
      setShowAccountSelector(false);
    }
  }, [accounts, showAccountSelector, selectAccount, setShowAccountSelector]);

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
    // Clear local error whenever button is clicked
    setLocalError(null);

    if (isWalletConnected || selectedAccount) {
      logout();
      // Also clear persistent name
      setPersistentName(null);
      localStorage.removeItem(config.auth.walletName);
    } else {
      connect().catch(() => {
        // Error handling is done in the Auth Provider
        // Here we just ensure the connect promise doesn't cause unhandled rejection
      });
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
   * Only use error styling if localError is set
   */
  const getButtonClasses = () => {
    if (localError) {
      return styles.walletButtonError;
    } else if (isWalletConnected || selectedAccount) {
      return styles.walletButtonConnected;
    } else {
      return styles.walletButtonConnect;
    }
  };

  return (
    <div className={styles.walletConnector}>
      {!isWalletConnected && !selectedAccount ? (
        // Disconnected state button
        <button
          onClick={handleButtonClick}
          disabled={isConnecting}
          className={getButtonClasses()}
          title={localError || 'Connect to wallet'}
          data-testid="connect-button"
        >
          {isConnecting ? (
            <>
              <FiLoader className={styles.loadingIcon} />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <FaWallet />
              <span>Connect Wallet</span>
            </>
          )}
        </button>
      ) : (
        // Connected state button
        <button
          className={getButtonClasses()}
          onClick={handleButtonClick}
          title={localError ? localError : 'Click to disconnect'}
          data-testid="wallet-button"
        >
          <div className={styles.walletInfo}>
            <span className={styles.walletName}>{displayName}</span>
            <span className={styles.walletAddress}>{shortAddress}</span>
          </div>
          <div className={styles.disconnectButton} title="Disconnect">
            <FiX />
          </div>
        </button>
      )}

      {/* Only show account selector if there are multiple accounts */}
      {showAccountSelector && accounts && accounts.length > 1 && <AccountSelector />}
    </div>
  );
};

export default WalletConnector;
