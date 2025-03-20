"use client";

import { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import { config } from '@/config';
import { u8aToHex, stringToU8a } from '@polkadot/util';

// Import types only, not the actual implementations
import type {
  InjectedExtension,
  Unsubcall
} from '@polkadot/extension-inject/types';

// Define types for dynamic imports
type Web3EnableFn = (originName: string) => Promise<InjectedExtension[]>;
type Web3AccountsFn = () => Promise<InjectedAccountWithMeta[]>;
type Web3AccountsSubscribeFn = (cb: (accounts: InjectedAccountWithMeta[]) => void) => Promise<Unsubcall>;
type Web3FromAddressFn = (address: string) => Promise<InjectedExtension>;

export class WalletService {
  // Track initialization state
  private static initialized = false;
  private static accountsSubscription: (() => void) | null = null;
  private static lastKnownAccounts: InjectedAccountWithMeta[] = [];

  // Dynamic API references to avoid SSR issues
  private static _web3Enable: Web3EnableFn | null = null;
  private static _web3Accounts: Web3AccountsFn | null = null;
  private static _web3AccountsSubscribe: Web3AccountsSubscribeFn | null = null;
  private static _web3FromAddress: Web3FromAddressFn | null = null;

  // Lazily load APIs only when needed (client-side only)
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
   * Enable wallet extension
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
   * Get accounts from wallet
   */
  static async getAccounts(): Promise<InjectedAccountWithMeta[]> {
    if (typeof window === 'undefined') return [];

    try {
      // Load APIs if not already loaded
      const apisLoaded = await this.loadApis();
      if (!apisLoaded || !this._web3Accounts) return [];

      // Ensure wallet is enabled
      if (!this.initialized) {
        const enabled = await this.enableWallet();
        if (!enabled) return [];
      }

      // Get accounts
      const accounts = await this._web3Accounts();
      this.lastKnownAccounts = accounts;
      return accounts;
    } catch (error) {
      console.error('Failed to get accounts:', error);
      return [];
    }
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
      const injector = await this._web3FromAddress(address);
      const signRaw = injector?.signer?.signRaw;

      if (!signRaw) {
        throw new Error('Signing not supported by this extension');
      }

      // Request signature
      const result = await signRaw({
        address,
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
      this.lastKnownAccounts = accounts;
      this.notifyAccountsChanged(accounts);
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
  static getCachedAccounts(): InjectedAccountWithMeta[] {
    return this.lastKnownAccounts;
  }

  // Account change listeners
  private static accountListeners: Set<(accounts: InjectedAccountWithMeta[]) => void> = new Set();

  /**
   * Subscribe to account changes
   * Returns a function to unsubscribe
   */
  static subscribeToAccountChanges(
    callback: (accounts: InjectedAccountWithMeta[]) => void
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
  private static notifyAccountsChanged(accounts: InjectedAccountWithMeta[]): void {
    this.accountListeners.forEach(listener => {
      try {
        listener(accounts);
      } catch (error) {
        console.error('Error in account change listener:', error);
      }
    });
  }
}
