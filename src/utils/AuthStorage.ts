/**
 * Helper functions for storing and retrieving authentication data
 */

import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';

// Storage keys
const WALLET_STORAGE_KEY = 'wallet-account';
const TOKEN_STORAGE_KEY = 'auth-token';

// Save wallet account data
export function saveWalletAccount(account: InjectedAccountWithMeta): void {
  if (!account) return;

  try {
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(account));
  } catch (e) {
    console.error('Error saving wallet account:', e);
  }
}

// Get stored wallet account
export function getStoredWalletAccount(): InjectedAccountWithMeta | null {
  try {
    const data = localStorage.getItem(WALLET_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Error retrieving wallet account:', e);
    return null;
  }
}

// Save auth token
export function saveAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch (e) {
    console.error('Error saving auth token:', e);
  }
}

// Get stored auth token
export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (e) {
    console.error('Error retrieving auth token:', e);
    return null;
  }
}

// Clear all stored auth data
export function clearAuthStorage(): void {
  try {
    localStorage.removeItem(WALLET_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing auth storage:', e);
  }
}
