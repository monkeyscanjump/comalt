"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AuthContext from './AuthContext';
import { WalletService } from './WalletService';
import { config } from '@/config';
import {
  hasWhitelistedAddresses,
  hasWhitelistedAddressesAsync,
  isAddressAllowedAsync
} from '@/config/whitelist';
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import type { User } from '@/types/user';

/**
 * AuthProvider manages authentication state for the application.
 * Handles wallet connections, signatures, and auth tokens.
 * Supports both public mode and restricted access mode.
 */
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Account and wallet states
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<InjectedAccountWithMeta[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<InjectedAccountWithMeta | null>(null);

  // UI states
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAccountSelector, setShowAccountSelector] = useState(false);

  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAllowed, setIsAllowed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Signature states
  const [wasSignatureRejected, setWasSignatureRejected] = useState(false);
  const [isRequestingSignature, setIsRequestingSignature] = useState(false);

  // Public mode detection - we'll use the sync version for initialization but update with async later
  const isPublicMode = !hasWhitelistedAddresses();

  // Calculate derived states
  const isWalletConnected = !!selectedAccount || !!walletAddress;

  // Clear authentication state when switching to public mode
  useEffect(() => {
    if (isPublicMode && (isAuthenticated || isWalletConnected)) {
      // Clear auth state when transitioning to public mode for consistency
      logout();
    }
  }, [isPublicMode, isAuthenticated, isWalletConnected]);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // First check if we're in public mode - this will populate the cache
        await hasWhitelistedAddressesAsync();

        // If in public mode, don't restore auth state
        if (isPublicMode) {
          setIsLoading(false);
          return;
        }

        // Restore connection from localStorage if available
        const storedAddress = localStorage.getItem(config.auth.walletAddress);
        const storedToken = localStorage.getItem(config.auth.tokenName);

        if (storedAddress) {
          setWalletAddress(storedAddress);

          // Check if this specific address is allowed by the whitelist using the async API
          const addressIsAllowed = await isAddressAllowedAsync(storedAddress);

          // If address is not allowed, clear storage and don't proceed with auth
          if (!addressIsAllowed) {
            localStorage.removeItem(config.auth.walletAddress);
            localStorage.removeItem(config.auth.tokenName);
            localStorage.removeItem('user-data');
            setWalletAddress(null);
            setIsLoading(false);
            return;
          }

          setIsAllowed(addressIsAllowed);

          // Get accounts if extension is available
          try {
            const isEnabled = await WalletService.enableWallet();
            if (isEnabled) {
              const walletAccounts = await WalletService.getAccounts();
              setAccounts(walletAccounts);

              // Find the stored account
              const account = walletAccounts.find(acc => acc.address === storedAddress);
              if (account) {
                setSelectedAccount(account);
              }
            }
          } catch (err) {
            // Failed to restore wallet connection, continue with basic state
          }

          // Restore auth state only if address is allowed
          if (storedToken && addressIsAllowed) {
            setToken(storedToken);
            setIsAuthenticated(true);

            try {
              // Restore user data if available
              const userData = localStorage.getItem('user-data');
              if (userData) {
                setUser(JSON.parse(userData));
              }
            } catch (e) {
              // Failed to restore user data, continue with basic state
            }
          }
        }
      } catch (err) {
        // Error initializing auth, continue with default state
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [isPublicMode]);

  /**
   * Connect to wallet extension and get available accounts
   */
  const connect = async (): Promise<boolean> => {
    setIsConnecting(true);
    setError(null);

    try {
      // Enable wallet extension
      const isEnabled = await WalletService.enableWallet();
      if (!isEnabled) {
        throw new Error('Wallet extension not found or not enabled');
      }

      // Get accounts
      const walletAccounts = await WalletService.getAccounts();
      if (!walletAccounts || walletAccounts.length === 0) {
        throw new Error('No accounts found in wallet');
      }

      // Update state
      setAccounts(walletAccounts);
      setShowAccountSelector(true);

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Select an account from the wallet
   */
  const selectAccount = async (account: InjectedAccountWithMeta): Promise<void> => {
    // Update state with selected account
    setSelectedAccount(account);
    setWalletAddress(account.address);
    setShowAccountSelector(false);

    // Save to localStorage
    localStorage.setItem(config.auth.walletAddress, account.address);

    try {
      // Check if the SPECIFIC account is allowed by the whitelist using the async API
      const addressIsAllowed = await isAddressAllowedAsync(account.address);
      setIsAllowed(addressIsAllowed);
    } catch (error) {
      setIsAllowed(false);
    }

    // Reset signature rejection state when selecting a new account
    setWasSignatureRejected(false);
  };

  /**
   * Sign a message with the selected account
   */
  const signMessage = useCallback(async (message: string, accountOverride?: InjectedAccountWithMeta): Promise<string | null> => {
    const addressToUse = accountOverride?.address || selectedAccount?.address || walletAddress;
    if (!addressToUse) return null;

    try {
      return await WalletService.signMessage(addressToUse, message);
    } catch (err) {
      // Check if user rejected the signature
      const isRejection = err instanceof Error &&
        (err.message.toLowerCase().includes('reject') ||
         err.message.toLowerCase().includes('cancel') ||
         err.message.toLowerCase().includes('denied') ||
         err.message.toLowerCase().includes('user cancelled'));

      if (isRejection) {
        setWasSignatureRejected(true);
      }

      throw err;
    }
  }, [selectedAccount, walletAddress, setWasSignatureRejected]);

  /**
   * Request a signature for authentication
   */
  const requestSignature = useCallback(async (address: string): Promise<boolean> => {
    if (!address) return false;

    try {
      // Add critical whitelist check using the async API
      const addressIsAllowed = await isAddressAllowedAsync(address);
      if (!addressIsAllowed) {
        setError('This wallet address is not authorized');
        return false;
      }

      setIsRequestingSignature(true);
      setWasSignatureRejected(false);

      // Create a unique message
      const message = `Sign this message to authenticate with comalt: ${Date.now()}`;

      // Get signature - this might throw if rejected
      const signature = await signMessage(message);

      if (!signature) {
        return false;
      }

      // In a real app, you'd verify this signature on the server
      const token = 'auth-token-' + Date.now(); // Simplified token
      setToken(token);
      localStorage.setItem(config.auth.tokenName, token);

      // Set authenticated state
      setIsAuthenticated(true);

      // Create user object
      const user = {
        id: '1',
        address,
        name: selectedAccount?.meta?.name || null,
        isAdmin: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date()
      };

      setUser(user);
      localStorage.setItem('user-data', JSON.stringify(user));

      return true;
    } catch (err) {
      // Check if this was a rejection
      const isRejection = err instanceof Error &&
        (err.message.toLowerCase().includes('reject') ||
         err.message.toLowerCase().includes('cancel') ||
         err.message.toLowerCase().includes('denied'));

      if (isRejection) {
        setWasSignatureRejected(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to sign message');
      }

      return false;
    } finally {
      setIsRequestingSignature(false);
    }
  }, [
    selectedAccount,
    setError,
    setIsRequestingSignature,
    setWasSignatureRejected,
    signMessage,
    setToken,
    setIsAuthenticated,
    setUser
  ]);

  /**
   * Auto-trigger signature request when wallet is connected and allowed
   */
  useEffect(() => {
    // Skip if still loading, already authenticated, requesting signature, or in public mode
    // Also skip if signature was previously rejected - don't auto-retry after rejection
    if (isLoading || isAuthenticated || isRequestingSignature || isPublicMode || wasSignatureRejected) {
      return;
    }

    // If we have a connected wallet and it's allowed but not authenticated, request signature
    if (selectedAccount && isAllowed && !isAuthenticated) {
      // Short delay to ensure all state is properly updated
      const timer = setTimeout(async () => {
        try {
          await requestSignature(selectedAccount.address);
        } catch (err) {
          // Signature request failed silently
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [
    selectedAccount,
    isAllowed,
    isAuthenticated,
    isLoading,
    isRequestingSignature,
    isPublicMode,
    wasSignatureRejected,
    requestSignature
  ]);

  /**
   * Refresh authentication token
   */
  const refreshAuthToken = async (): Promise<boolean> => {
    if (!isAuthenticated || !walletAddress) return false;

    try {
      // Verify wallet is still allowed before refreshing token using the async API
      const addressIsAllowed = await isAddressAllowedAsync(walletAddress);
      if (!addressIsAllowed) {
        logout(); // Force logout if address no longer allowed
        return false;
      }

      const newToken = 'refreshed-token-' + Date.now();
      setToken(newToken);
      localStorage.setItem(config.auth.tokenName, newToken);
      return true;
    } catch (err) {
      return false;
    }
  };

  /**
   * Logout and clear all authentication state
   */
  const logout = () => {
    setSelectedAccount(null);
    setWalletAddress(null);
    setIsAuthenticated(false);
    setIsAllowed(false);
    setUser(null);
    setToken(null);
    setWasSignatureRejected(false);

    // Clear localStorage
    localStorage.removeItem(config.auth.walletAddress);
    localStorage.removeItem(config.auth.tokenName);
    localStorage.removeItem('user-data');
  };

  /**
   * Reset signature rejection state
   */
  const resetRejectionState = () => {
    setWasSignatureRejected(false);
  };

  return (
    <AuthContext.Provider
      value={{
        // Account states
        walletAddress,
        accounts,
        selectedAccount,

        // UI states
        error,
        showAccountSelector,
        setShowAccountSelector,

        // User data
        user,
        token,

        // Core methods
        logout,
        connect,
        selectAccount,
        signMessage,
        refreshAuthToken,
        requestSignature,

        // Signature states
        wasSignatureRejected,
        isRequestingSignature,
        resetRejectionState,

        // Derived states
        isPublicMode,
        isWalletConnected,
        isAuthenticated,
        isLoading,
        isAllowed,
        isConnecting
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
