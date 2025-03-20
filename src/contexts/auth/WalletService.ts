"use client";

import { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import { config } from '@/config';
import { u8aToHex, stringToU8a, hexToU8a } from '@polkadot/util';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';

// Import types only, not the actual implementations
import type {
  InjectedExtension,
  Unsubcall
} from '@polkadot/extension-inject/types';
import type { KeypairType } from '@polkadot/util-crypto/types';

// Define types for dynamic imports with correct typing
interface Web3AccountsOptions {
  ss58Format?: number;
  accountType?: KeypairType[];
}

// Extended interface for the account metadata with original address
interface ExtendedMeta {
  name?: string;
  source: string;
  genesisHash?: string | null;
  originalAddress?: string;
  [key: string]: any; // Allow other properties
}

// Extended interface for account with modified meta
interface ExtendedInjectedAccountWithMeta extends Omit<InjectedAccountWithMeta, 'meta'> {
  meta: ExtendedMeta;
}

type Web3EnableFn = (originName: string) => Promise<InjectedExtension[]>;
type Web3AccountsFn = (options?: Web3AccountsOptions) => Promise<InjectedAccountWithMeta[]>;
type Web3AccountsSubscribeFn = (cb: (accounts: InjectedAccountWithMeta[]) => void) => Promise<Unsubcall>;
type Web3FromAddressFn = (address: string) => Promise<InjectedExtension>;

/**
 * Service for interacting with Polkadot/Substrate wallet extensions.
 * Handles extension detection, account retrieval, signing, and account change monitoring.
 */
export class WalletService {
  // Track initialization state
  private static initialized = false;
  private static accountsSubscription: (() => void) | null = null;
  private static lastKnownAccounts: ExtendedInjectedAccountWithMeta[] = [];

  // Dynamic API references to avoid SSR issues
  private static _web3Enable: Web3EnableFn | null = null;
  private static _web3Accounts: Web3AccountsFn | null = null;
  private static _web3AccountsSubscribe: Web3AccountsSubscribeFn | null = null;
  private static _web3FromAddress: Web3FromAddressFn | null = null;

  /**
   * Normalize a Substrate address to a standard format
   * This helps with address comparison when addresses might be in different formats
   */
  static normalizeAddress(address: string): string {
    try {
      // Convert address to standard Substrate format (ss58Format = 42)
      // This ensures consistent comparison regardless of the format the wallet uses
      const publicKey = decodeAddress(address);
      return encodeAddress(publicKey, 42);
    } catch (error) {
      console.error('Failed to normalize address:', error);
      return address; // Return original if normalization fails
    }
  }

  /**
   * Lazily load Polkadot APIs only when needed (client-side only)
   */
  private static async loadApis(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      // Only load if not already loaded
      if (!this._web3Enable) {
        const extensionDapp = await import('@polkadot/extension-dapp');
        this._web3Enable = extensionDapp.web3Enable;
        this._web3Accounts = extensionDapp.web3Accounts;
        this._web3AccountsSubscribe = extensionDapp.web3AccountsSubscribe;
        this._web3FromAddress = extensionDapp.web3FromAddress;
      }
      return true;
    } catch (error) {
      console.error('Failed to load Polkadot extension APIs:', error);
      return false;
    }
  }

  /**
   * Check if wallet extension is available without requesting permissions
   */
  static async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      // Check for injectedWeb3 without triggering permission prompts
      const injectedWeb3 = (window as any).injectedWeb3;

      // Check if 'polkadot-js' or other Substrate wallets are present
      return !!injectedWeb3 && (
        !!injectedWeb3['polkadot-js'] ||
        !!injectedWeb3['subwallet-js'] ||
        !!injectedWeb3['talisman'] ||
        Object.keys(injectedWeb3).length > 0
      );
    } catch (error) {
      console.error('Error checking extension availability:', error);
      return false;
    }
  }

  /**
   * Check if wallet extension is available (alias for isAvailable for backward compatibility)
   */
  static isWalletExtensionAvailable(): boolean {
    // Synchronous check without async, just checks if injectedWeb3 exists
    if (typeof window === 'undefined') return false;

    try {
      return !!(window as any).injectedWeb3;
    } catch (error) {
      return false;
    }
  }

  /**
   * Enable wallet extension and request access
   */
  static async enableWallet(appName: string = config.app.name): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      // Load APIs if not already loaded
      const apisLoaded = await this.loadApis();
      if (!apisLoaded || !this._web3Enable) return false;

      console.log('Enabling wallet extension...');
      // Clear any previous state to avoid conflicts
      this.initialized = false;

      // Enable the extension with proper app name
      const extensions = await this._web3Enable(appName);
      console.log('Available extensions:', extensions);

      // Successfully enabled if any extension is returned
      const hasExtension = extensions && extensions.length > 0;
      this.initialized = hasExtension;

      // Start monitoring accounts if enabled
      if (hasExtension) {
        this.startAccountsMonitoring();
      }

      return hasExtension;
    } catch (error) {
      console.error('Error enabling wallet:', error);
      return false;
    }
  }

  /**
   * Get accounts from all enabled wallet extensions
   * @param forceRefresh Whether to force a fresh connection to the wallet
   */
  static async getAccounts(forceRefresh = false): Promise<ExtendedInjectedAccountWithMeta[]> {
    if (typeof window === 'undefined') return [];

    try {
      // Load APIs if not already loaded
      const apisLoaded = await this.loadApis();
      if (!apisLoaded || !this._web3Accounts) return [];

      // Re-enable wallet if forcing refresh or not initialized
      if (forceRefresh || !this.initialized) {
        const enabled = await this.enableWallet();
        if (!enabled) return [];
      }

      // Get accounts with specific options to ensure we get all types
      const accounts = await this._web3Accounts({
        ss58Format: 42,  // Use standard Substrate format for consistency
        accountType: ['sr25519', 'ed25519', 'ecdsa'] as KeypairType[] // Type cast to KeypairType[]
      });

      // Process accounts to normalize addresses
      const normalizedAccounts = accounts.map(account => ({
        ...account,
        address: this.normalizeAddress(account.address),
        // Add original address for reference if needed
        meta: {
          ...account.meta,
          originalAddress: account.address
        }
      })) as ExtendedInjectedAccountWithMeta[];

      // Log the accounts we found for debugging
      console.log(`Retrieved ${normalizedAccounts.length} accounts:`,
        normalizedAccounts.map(acc => ({
          name: acc.meta.name,
          source: acc.meta.source,
          address: `${acc.address.slice(0, 6)}...${acc.address.slice(-4)}`
        }))
      );

      // If no accounts found and not already retrying, try enable again
      if (normalizedAccounts.length === 0 && !forceRefresh) {
        console.log('No accounts found, trying with force refresh...');
        return this.getAccounts(true);
      }

      this.lastKnownAccounts = normalizedAccounts;
      return normalizedAccounts;
    } catch (error) {
      console.error('Failed to get accounts:', error);
      return [];
    }
  }

  /**
   * Get accounts grouped by wallet extension source
   */
  static async getAccountsBySource(): Promise<Record<string, ExtendedInjectedAccountWithMeta[]>> {
    const accounts = await this.getAccounts();

    // Group accounts by their extension source
    return accounts.reduce((grouped, account) => {
      const source = account.meta.source || 'unknown';
      if (!grouped[source]) {
        grouped[source] = [];
      }
      grouped[source].push(account);
      return grouped;
    }, {} as Record<string, ExtendedInjectedAccountWithMeta[]>);
  }

  /**
   * Prepare message for consistent signing
   */
  private static prepareMessage(message: string): string {
    // Check if the message is already in <Bytes>...</Bytes> format
    if (message.startsWith('<Bytes>') && message.endsWith('</Bytes>')) {
      return message;
    }
    // Convert to explicit hex format for consistent handling
    return u8aToHex(stringToU8a(message));
  }

  /**
   * Sign a message with wallet
   */
  static async signMessage(address: string, message: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    try {
      // Load APIs if not already loaded
      const apisLoaded = await this.loadApis();
      if (!apisLoaded || !this._web3FromAddress) return null;

      // Ensure wallet is enabled
      if (!this.initialized) {
        const enabled = await this.enableWallet();
        if (!enabled) return null;
      }

      // Format message properly
      const formattedMessage = this.prepareMessage(message);

      console.log('Requesting signature for:', {
        address,
        message: formattedMessage
      });

      // Get the injector for this address
      // Use original address if it exists in the metadata of any account
      const accountWithAddress = this.lastKnownAccounts.find(acc =>
        acc.address === address || acc.meta.originalAddress === address
      );

      const addressToUse = accountWithAddress?.meta.originalAddress || address;

      const injector = await this._web3FromAddress(addressToUse);
      const signRaw = injector?.signer?.signRaw;

      if (!signRaw) {
        throw new Error('Signing not supported by this extension');
      }

      // Request signature
      const result = await signRaw({
        address: addressToUse,
        data: formattedMessage,
        type: 'bytes'
      });

      console.log('Signature received');
      return result.signature;
    } catch (error) {
      console.error('Signing error:', error);

      // Check if the error is a rejection
      const isRejection = error instanceof Error &&
        (error.message.toLowerCase().includes('reject') ||
         error.message.toLowerCase().includes('cancel') ||
         error.message.toLowerCase().includes('denied') ||
         error.message.toLowerCase().includes('user cancelled'));

      // Rethrow with context
      if (isRejection) {
        throw new Error(`WALLET_REJECTION: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Start monitoring wallet accounts
   */
  private static async startAccountsMonitoring(): Promise<void> {
    if (typeof window === 'undefined') return;

    // Load APIs if not already loaded
    const apisLoaded = await this.loadApis();
    if (!apisLoaded || !this._web3AccountsSubscribe) return;

    // Clear any existing subscription
    if (this.accountsSubscription) {
      this.accountsSubscription();
      this.accountsSubscription = null;
    }

    // Start a new subscription
    this._web3AccountsSubscribe((accounts) => {
      // Normalize addresses for consistency
      const normalizedAccounts = accounts.map(account => ({
        ...account,
        address: this.normalizeAddress(account.address),
        meta: {
          ...account.meta,
          originalAddress: account.address
        }
      })) as ExtendedInjectedAccountWithMeta[];

      this.lastKnownAccounts = normalizedAccounts;
      this.notifyAccountsChanged(normalizedAccounts);
    }).then(unsubscribe => {
      this.accountsSubscription = unsubscribe;
    }).catch(error => {
      console.error('Failed to subscribe to accounts:', error);
    });
  }

  /**
   * Stop monitoring wallet accounts
   */
  static stopAccountsMonitoring(): void {
    if (this.accountsSubscription) {
      this.accountsSubscription();
      this.accountsSubscription = null;
    }
  }

  /**
   * Get the last known accounts without making a new request
   */
  static getCachedAccounts(): ExtendedInjectedAccountWithMeta[] {
    return this.lastKnownAccounts;
  }

  // Account change listeners
  private static accountListeners: Set<(accounts: ExtendedInjectedAccountWithMeta[]) => void> = new Set();

  /**
   * Subscribe to account changes
   * Returns a function to unsubscribe
   */
  static subscribeToAccountChanges(
    callback: (accounts: ExtendedInjectedAccountWithMeta[]) => void
  ): () => void {
    this.accountListeners.add(callback);

    // If we already have accounts, notify immediately
    if (this.lastKnownAccounts.length > 0) {
      setTimeout(() => callback(this.lastKnownAccounts), 0);
    }

    return () => {
      this.accountListeners.delete(callback);
    };
  }

  /**
   * Notify all listeners about account changes
   */
  private static notifyAccountsChanged(accounts: ExtendedInjectedAccountWithMeta[]): void {
    this.accountListeners.forEach(listener => {
      try {
        listener(accounts);
      } catch (error) {
        console.error('Error in account change listener:', error);
      }
    });
  }
}
