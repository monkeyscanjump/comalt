'use client';

// Import the exact types from Polkadot
import type { InjectedAccountWithMeta, InjectedExtension } from '@polkadot/extension-inject/types';
// Define Web3AccountsOptions inline instead of importing
interface Web3AccountsOptions {
  created?: Date;
  genesisHash?: string;
  ss58Format?: number;
  type?: 'sr25519' | 'ed25519' | 'ecdsa';
  withAny?: boolean;
  withHardware?: boolean;
}

// Define VerifyResult inline instead of importing
interface VerifyResult {
  crypto: 'none' | 'ed25519' | 'sr25519' | 'ecdsa' | 'ethereum' | string;
  isValid: boolean;
  isWrapped: boolean;
  publicKey: Uint8Array;
}

import { u8aToHex, stringToU8a, hexToU8a } from '@polkadot/util';

// Safe browser check
const isBrowser = typeof window !== 'undefined';

// No-op function for empty callbacks
const noop = () => { /* intentionally empty */ };

// Store for Polkadot extension API functions - properly typed
interface ExtensionApis {
  web3Enable: ((appName: string) => Promise<InjectedExtension[]>) | null;
  web3AccountsSubscribe: ((callback: (accounts: InjectedAccountWithMeta[]) => void) => Promise<() => void>) | null;
  web3FromAddress: ((address: string) => Promise<InjectorWithSigner>) | null;
  web3Accounts: ((options?: Web3AccountsOptions) => Promise<InjectedAccountWithMeta[]>) | null;
  signatureVerify: ((message: string | Uint8Array, signature: string | Uint8Array, address: string | Uint8Array, crypto?: 'ed25519' | 'sr25519' | 'ecdsa') => VerifyResult) | null;
}

// Better type for injector return
interface InjectorWithSigner {
  signer?: {
    signRaw?: (params: {
      address: string;
      data: string;
      type: 'bytes' | 'payload';
    }) => Promise<{ signature: string }>;
  } | null;
  [key: string]: any;
}

// Track initialization state
let isInitialized = false;
let isInitializing = false;
const initCallbacks: Array<() => void> = [];
let initRetries = 0;
const MAX_RETRIES = 3;

// Extension detection status
let hasDetectedExtension: boolean | null = null;

// Store for Polkadot extension API functions
const extensionApis: ExtensionApis = {
  web3Enable: null,
  web3AccountsSubscribe: null,
  web3FromAddress: null,
  web3Accounts: null,
  signatureVerify: null
};

/**
 * Initialize Polkadot libraries asynchronously
 * Returns a promise that resolves when libraries are initialized
 */
export const ensurePolkadotInitialized = async (forceRetry = false): Promise<boolean> => {
  // Return immediately if already initialized or not in browser
  if (isInitialized && !forceRetry) return true;
  if (!isBrowser) return false;

  // If initialization is in progress, wait for it to complete
  if (isInitializing) {
    return new Promise<boolean>((resolve) => {
      initCallbacks.push(() => resolve(isInitialized));
    });
  }

  try {
    isInitializing = true;

    // Load APIs asynchronously
    const [extDapp, utilCrypto] = await Promise.all([
      import('@polkadot/extension-dapp'),
      import('@polkadot/util-crypto')
    ]);

    // Set the API functions
    extensionApis.web3Enable = extDapp.web3Enable;
    extensionApis.web3AccountsSubscribe = extDapp.web3AccountsSubscribe;
    extensionApis.web3FromAddress = extDapp.web3FromAddress;
    extensionApis.web3Accounts = extDapp.web3Accounts;
    extensionApis.signatureVerify = utilCrypto.signatureVerify;

    // Mark as initialized
    isInitialized = true;
    initRetries = 0;
    console.log('Polkadot libraries initialized successfully');

    // Notify any waiting callbacks
    initCallbacks.forEach(callback => callback());
    initCallbacks.length = 0;

    return true;
  } catch (err) {
    console.error("Failed to load Polkadot libraries:", err);
    initRetries++;

    // If we haven't exceeded retry limit, try again
    if (initRetries < MAX_RETRIES) {
      console.log(`Retrying initialization (attempt ${initRetries + 1}/${MAX_RETRIES})...`);
      isInitializing = false;
      return ensurePolkadotInitialized(true);
    }

    return false;
  } finally {
    isInitializing = false;
  }
};

/**
 * Check if Polkadot extension is available in the browser
 * This is a lightweight check that doesn't trigger permission prompts
 */
export const isExtensionAvailable = async (): Promise<boolean> => {
  if (!isBrowser) return false;

  // Use cached result if available
  if (hasDetectedExtension !== null) return hasDetectedExtension;

  try {
    // Check for injectedWeb3 without triggering permission prompts
    const injectedWeb3 = (window as any).injectedWeb3;

    // Check if 'polkadot-js' or other Substrate wallets are present
    hasDetectedExtension = !!injectedWeb3 && (
      !!injectedWeb3['polkadot-js'] ||
      !!injectedWeb3['subwallet-js'] ||
      !!injectedWeb3['talisman'] ||
      Object.keys(injectedWeb3).length > 0
    );

    return hasDetectedExtension;
  } catch (error) {
    console.error('Error checking extension availability:', error);
    return false;
  }
};

// Initialize on client only
if (isBrowser) {
  // Start initialization immediately, but don't wait for it
  ensurePolkadotInitialized().catch(console.error);
}

// Safe wrapper functions with proper types
export const web3Enable = async (appName: string): Promise<InjectedExtension[]> => {
  // Ensure libraries are initialized first
  await ensurePolkadotInitialized();

  if (!extensionApis.web3Enable) {
    console.warn('web3Enable not available');
    return [];
  }

  try {
    return await extensionApis.web3Enable(appName);
  } catch (error) {
    console.error('Error in web3Enable:', error);
    return [];
  }
};

// Updated with imported type
export const web3Accounts = async (options?: Web3AccountsOptions): Promise<InjectedAccountWithMeta[]> => {
  // Ensure libraries are initialized first
  await ensurePolkadotInitialized();

  if (!extensionApis.web3Accounts) {
    console.warn('web3Accounts not available');
    return [];
  }

  try {
    return await extensionApis.web3Accounts(options);
  } catch (error) {
    console.error('Error in web3Accounts:', error);
    return [];
  }
};

export const web3AccountsSubscribe = async (
  callback: (accounts: InjectedAccountWithMeta[]) => void
): Promise<() => void> => {
  // Ensure libraries are initialized first
  await ensurePolkadotInitialized();

  if (!extensionApis.web3AccountsSubscribe) {
    console.warn('web3AccountsSubscribe not available');
    return noop; // Using noop instead of empty arrow function
  }

  try {
    const unsubscribe = await extensionApis.web3AccountsSubscribe(callback);
    return unsubscribe;
  } catch (error) {
    console.error('Error in web3AccountsSubscribe:', error);
    return noop; // Using noop instead of empty arrow function
  }
};

export const web3FromAddress = async (address: string): Promise<InjectorWithSigner> => {
  // Ensure libraries are initialized first
  await ensurePolkadotInitialized();

  if (!extensionApis.web3FromAddress) {
    console.warn('web3FromAddress not available');
    return { signer: null };
  }

  try {
    return await extensionApis.web3FromAddress(address);
  } catch (error) {
    console.error('Error in web3FromAddress:', error);
    return { signer: null };
  }
};

interface SignMessageParams {
  address: string;
  message: string;
  callbackFn?: (_result: any) => void;
}

/**
 * Prepare message for consistent signing and verification
 * This ensures messages are formatted the same way for signing and verification
 */
export const prepareMessage = (message: string): string => {
  // Check if the message is already in <Bytes>...</Bytes> format
  if (message.startsWith('<Bytes>') && message.endsWith('</Bytes>')) {
    return message;
  }
  // Convert to explicit hex format for consistent handling
  return u8aToHex(stringToU8a(message));
};

export const signMessage = async ({ address, message, callbackFn }: SignMessageParams): Promise<string | null> => {
  // Ensure libraries are initialized first
  await ensurePolkadotInitialized();

  if (!extensionApis.web3FromAddress) {
    console.warn('Signing not available');
    return null;
  }

  try {
    const injector = await web3FromAddress(address);
    const signRaw = injector?.signer?.signRaw;

    if (!signRaw) {
      throw new Error('Signing not supported by this extension');
    }

    const result = await signRaw({
      address,
      data: message,
      type: 'bytes'
    });

    // Call the callback only if provided
    if (callbackFn) {
      callbackFn(result);
    }

    return result.signature;
  } catch (error) {
    // Format error message to help identify rejection
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      if (
        errorMsg.includes('reject') ||
        errorMsg.includes('cancel') ||
        errorMsg.includes('denied') ||
        errorMsg.includes('user declined')
      ) {
        error.message = `Rejected by user: ${error.message}`;
      }
    }
    throw error; // Let the caller handle the error
  }
};

// Export for compatibility with existing code
export const web3SignMessage = signMessage;

export const signatureVerify = async (
  message: string | Uint8Array,
  signature: string | Uint8Array,
  address: string | Uint8Array,
  crypto?: 'ed25519' | 'sr25519' | 'ecdsa'
): Promise<VerifyResult> => {
  // Ensure libraries are initialized first
  await ensurePolkadotInitialized();

  if (!extensionApis.signatureVerify) {
    console.warn('signatureVerify not available');
    return { isValid: false, crypto: 'none', isWrapped: false, publicKey: new Uint8Array() };
  }

  try {
    // Use the crypto parameter if provided
    if (crypto) {
      return (extensionApis.signatureVerify as any)(message, signature, address, crypto);
    }
    return extensionApis.signatureVerify(message, signature, address);
  } catch (error) {
    console.error('Error in signatureVerify:', error);
    return { isValid: false, crypto: 'none', isWrapped: false, publicKey: new Uint8Array() };
  }
};

// Export util functions for verification
export { u8aToHex, stringToU8a, hexToU8a };
