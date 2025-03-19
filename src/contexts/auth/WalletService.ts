import { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import { config } from '@/config';
import {
  web3Enable,
  web3AccountsSubscribe,
  web3SignMessage,
  web3Accounts,
  isExtensionAvailable,
  prepareMessage
} from '@/lib/polkadot';

export class WalletService {
  // Track initialization state
  private static initialized = false;
  private static accountsSubscription: (() => void) | null = null;
  private static lastKnownAccounts: InjectedAccountWithMeta[] = [];

  /**
   * Check if wallet extension is available without requesting permissions
   */
  static async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    return isExtensionAvailable();
  }

  /**
   * Enable wallet extension
   */
  static async enableWallet(appName: string = config.app.name): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      console.log('Enabling wallet extension...');
      // Clear any previous state to avoid conflicts
      this.initialized = false;

      // Enable the extension with proper app name
      const extensions = await web3Enable(appName);
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
   * If the wallet isn't enabled yet, this will enable it first
   */
  static async getAccounts(): Promise<InjectedAccountWithMeta[]> {
    if (typeof window === 'undefined') return [];

    try {
      // Ensure wallet is enabled
      if (!this.initialized) {
        const enabled = await this.enableWallet();
        if (!enabled) return [];
      }

      // Use proper empty options object
      const accounts = await web3Accounts({});
      this.lastKnownAccounts = accounts;
      return accounts;
    } catch (error) {
      console.error('Failed to get accounts:', error);
      return [];
    }
  }

  /**
   * Sign a message with wallet
   * Ensures proper message formatting for consistent signing
   */
  static async signMessage(address: string, message: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    try {
      // Ensure wallet is enabled
      if (!this.initialized) {
        const enabled = await this.enableWallet();
        if (!enabled) return null;
      }

      // Format message properly
      const formattedMessage = prepareMessage ? prepareMessage(message) : message;

      console.log('Requesting signature for:', {
        address,
        message: formattedMessage
      });

      // Fix signMessage parameters - removing callbackFn if it's causing errors
      const signature = await web3SignMessage({
        address,
        message: formattedMessage
      });

      console.log('Signature received');
      return signature;
    } catch (error) {
      console.error('Signing error:', error);

      // Check if the error is a rejection
      const isRejection = error instanceof Error &&
        (error.message.toLowerCase().includes('reject') ||
         error.message.toLowerCase().includes('cancel'));

      // Rethrow with more context
      if (isRejection) {
        throw new Error(`WALLET_REJECTION: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Start monitoring wallet accounts
   * This keeps lastKnownAccounts up to date and can notify listeners of changes
   */
  private static startAccountsMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Clear any existing subscription
    if (this.accountsSubscription) {
      this.accountsSubscription();
      this.accountsSubscription = null;
    }

    // Start a new subscription
    web3AccountsSubscribe((accounts) => {
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
