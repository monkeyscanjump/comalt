"use client";

import React, { useState, useEffect, useCallback } from 'react';
import AuthContext from './AuthContext';
import { WalletService } from './WalletService';
import { config } from '@/config';
import { AuthAPI } from './AuthAPI';
import {
  hasWhitelistedAddresses,
  hasWhitelistedAddressesAsync,
  isAddressAllowedAsync
} from '@/config/whitelist';
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import type { User } from '@/types/user';
import { getPublicEnv } from '@/utils/env';

/**
 * Generates a unique user ID from a wallet address
 */
const generateUniqueUserId = (address: string): string => {
  // Create a hash from the address to ensure uniqueness between wallets
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    const char = address.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Use address prefix plus hash portion for a readable but unique ID
  const prefix = address.substring(0, 6);
  const hashPart = Math.abs(hash).toString(16).substring(0, 8);

  return `${prefix}-${hashPart}`;
};

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
  const [isCheckingAllowlist, setIsCheckingAllowlist] = useState(false);

  // Signature states
  const [wasSignatureRejected, setWasSignatureRejected] = useState(false);
  const [isRequestingSignature, setIsRequestingSignature] = useState(false);

  // Public mode detection - we'll use the sync version for initialization but update with async later
  const isPublicMode = !hasWhitelistedAddresses();

  // Calculate derived states
  const isWalletConnected = !!selectedAccount || !!walletAddress;

  /**
   * Logout and clear all authentication state
   * Define this function early with useCallback to use in effects
   */
  const logout = useCallback(() => {
    // If we have a token, call the logout API
    if (token) {
      AuthAPI.logout(token).catch(err => {
        console.error('Logout API error:', err);
      });
    }

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
    localStorage.removeItem(config.auth.userData);
    localStorage.removeItem(config.auth.walletName);
  }, [token]);

  // Clear authentication state when switching to public mode
  useEffect(() => {
    if (isPublicMode && (isAuthenticated || isWalletConnected)) {
      // Clear auth state when transitioning to public mode for consistency
      logout();
    }
  }, [isPublicMode, isAuthenticated, isWalletConnected, logout]);

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
        const isAlreadyAuthenticated = !!storedToken;

        if (storedAddress) {
          setWalletAddress(storedAddress);

          // If we already have valid auth, prioritize loading the UI
          if (isAlreadyAuthenticated) {
            try {
              // Set states for authenticated user
              setToken(storedToken);
              setIsAuthenticated(true);

              // Restore user data immediately
              const userData = localStorage.getItem(config.auth.userData);
              if (userData) {
                setUser(JSON.parse(userData));
              }

              // Mark as allowed to let UI render
              setIsAllowed(true);

              // Start allowlist check in background with timeout
              setIsCheckingAllowlist(true);

              // Run check in background with timeout
              const timeoutPromise = new Promise<void>((resolve) => {
                setTimeout(resolve, 4000); // 4 second timeout
              });

              Promise.race([
                isAddressAllowedAsync(storedAddress).then(allowed => {
                  // Only update if check fails - don't interrupt user if already authenticated
                  if (!allowed) {
                    console.warn('Authenticated user failed allowlist check - preparing logout');
                    // Queue a logout after a short delay
                    setTimeout(() => {
                      logout();
                    }, 500);
                  }
                }),
                timeoutPromise
              ]).finally(() => {
                setIsCheckingAllowlist(false);
              });

              // Continue to UI without waiting
              setIsLoading(false);
              return;
            } catch (err) {
              console.error("Error restoring authenticated state:", err);
              // Continue with normal flow if this fails
            }
          }

          // Normal flow for non-authenticated users
          setIsCheckingAllowlist(true);

          try {
            // Create a timeout promise
            const timeoutPromise = new Promise<boolean>((_, reject) => {
              setTimeout(() => reject(new Error('Allowlist check timed out')), 5000);
            });

            // Race the actual check against the timeout
            const isAllowed = await Promise.race([
              isAddressAllowedAsync(storedAddress),
              timeoutPromise
            ]);

            setIsAllowed(isAllowed);

            if (!isAllowed) {
              // Clear storage and don't proceed with auth
              localStorage.removeItem(config.auth.walletAddress);
              localStorage.removeItem(config.auth.tokenName);
              localStorage.removeItem(config.auth.userData);
              setWalletAddress(null);
              setIsLoading(false);
              setIsCheckingAllowlist(false);
              return;
            }
          } catch (error) {
            console.error("Error checking allowlist:", error);
            setIsAllowed(false);
          } finally {
            setIsCheckingAllowlist(false);
          }
        }
      } catch (err) {
        console.error("Error initializing auth:", err);
      } finally {
        // Always clear loading state to prevent UI from getting stuck
        setIsLoading(false);
      }
    };

    initAuth();
  }, [isPublicMode, logout]);

  /**
   * Connect to wallet extension and get available accounts
   */
  const connect = async (): Promise<boolean> => {
    setIsConnecting(true);
    setError(null);

    try {
      // Check if extension is available
      if (!WalletService.isWalletExtensionAvailable()) {
        throw new Error('No wallet extension detected. Please install Polkadot.js or SubWallet extension.');
      }

      // Enable wallet extension
      const isEnabled = await WalletService.enableWallet();
      if (!isEnabled) {
        throw new Error('Wallet extension not found or not enabled');
      }

      // Get accounts with force refresh to ensure we get the latest
      const walletAccounts = await WalletService.getAccounts(true);

      if (!walletAccounts || walletAccounts.length === 0) {
        throw new Error('No accounts found in wallet. Please check wallet permissions or create an account first.');
      }

      // Update state
      setAccounts(walletAccounts);

      // IMPORTANT: Always show account selector, even with a single account
      // This ensures consistent behavior across different usage patterns
      setShowAccountSelector(true);

      return true;
    } catch (err) {
      console.error('Connect error:', err);
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
      // Set loading state for allowlist check
      setIsCheckingAllowlist(true);

      // Check if the SPECIFIC account is allowed by the whitelist using the async API
      const addressIsAllowed = await isAddressAllowedAsync(account.address);
      setIsAllowed(addressIsAllowed);
    } catch (error) {
      setIsAllowed(false);
    } finally {
      setIsCheckingAllowlist(false);
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
      // Set loading state for allowlist check
      setIsCheckingAllowlist(true);
      // Add critical whitelist check using the async API
      const addressIsAllowed = await isAddressAllowedAsync(address);
      if (!addressIsAllowed) {
        setError('This wallet address is not authorized');
        return false;
      }

      setIsCheckingAllowlist(false);
      setIsRequestingSignature(true);
      setWasSignatureRejected(false);

      // Create a unique message
      const message = `Sign this message to authenticate with ${getPublicEnv('APP_NAME', 'comAlt')}: ${Date.now()}`;

      // Get signature - this might throw if rejected
      const signature = await signMessage(message);

      if (!signature) {
        return false;
      }

      try {
        // Send the signature to the server for verification and get a JWT token
        const response = await AuthAPI.verifySignature(address, signature, message);

        if (!response || !response.token) {
          console.error('API returned invalid response:', response);
          setError('Server returned invalid response');
          return false;
        }

        const { token, user } = response;

        // Store token and user info
        setToken(token);
        setUser(user);
        localStorage.setItem(config.auth.tokenName, token);
        localStorage.setItem(config.auth.userData, JSON.stringify(user));

        // Set authenticated state
        setIsAuthenticated(true);

        return true;
      } catch (apiError) {
        console.error('API verification error:', apiError);
        setError(apiError instanceof Error ? apiError.message : 'Server verification failed');
        return false;
      }
    } catch (err) {
      // Handle signature rejection or other errors
      console.error('Signature request error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get signature');
      return false;
    } finally {
      setIsRequestingSignature(false);
    }
  }, [
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
    if (!isAuthenticated || !walletAddress || !token) return false;

    try {
      // Verify wallet is still allowed before refreshing token
      const addressIsAllowed = await isAddressAllowedAsync(walletAddress);
      if (!addressIsAllowed) {
        logout(); // Force logout if address no longer allowed
        return false;
      }

      // Use the API to refresh the token
      try {
        const response = await AuthAPI.refreshToken(token);

        if (!response || !response.token) {
          console.error('Token refresh API returned invalid response:', response);
          return false;
        }

        // Update state with the new token
        setToken(response.token);
        localStorage.setItem(config.auth.tokenName, response.token);

        // Update user data if returned
        if (response.user) {
          setUser(response.user);
          localStorage.setItem(config.auth.userData, JSON.stringify(response.user));
        }

        return true;
      } catch (apiError) {
        console.error('Token refresh API error:', apiError);
        return false;
      }
    } catch (err) {
      console.error('Token refresh error:', err);
      return false;
    }
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
        isConnecting,
        isCheckingAllowlist
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
