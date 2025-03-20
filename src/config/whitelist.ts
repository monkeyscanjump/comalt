/**
 * Whitelist configuration with environment detection
 * Handles both client and server environments efficiently
 */

// Cache settings
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache storage
let publicModeCache: { value: boolean | null; timestamp: number } = {
  value: null,
  timestamp: 0
};
const addressValidationCache = new Map<string, { isAllowed: boolean; timestamp: number }>();

// Request deduplication
let currentCheckRequest: Promise<boolean> | null = null;
const currentAddressRequests = new Map<string, Promise<boolean>>();

// Environment detection
const isServer = typeof window === 'undefined';

// Direct server-side implementation (avoids API calls on server)
import * as serverWhitelist from '@/lib/whitelist-server';

/**
 * Check if any addresses are configured in the whitelist
 */
export async function hasWhitelistedAddressesAsync(): Promise<boolean> {
  try {
    // Check cache first
    const now = Date.now();
    if (publicModeCache.value !== null && (now - publicModeCache.timestamp) < CACHE_TTL) {
      return !publicModeCache.value;
    }

    // If running on server, use direct implementation
    if (isServer) {
      const isPublic = serverWhitelist.isPublicMode();
      publicModeCache = {
        value: isPublic,
        timestamp: now
      };
      return !isPublic;
    }

    // On client, use API with request deduplication
    if (currentCheckRequest) {
      return currentCheckRequest;
    }

    // Create a new request and store the promise
    currentCheckRequest = fetch('/api/auth/check-mode')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to check whitelist mode');
        }
        return response.json();
      })
      .then(data => {
        // Update cache
        publicModeCache = {
          value: data.isPublicMode,
          timestamp: Date.now()
        };
        return !data.isPublicMode;
      })
      .catch(error => {
        console.error('Error checking whitelist mode:', error);
        return true; // Default to restricted mode
      })
      .finally(() => {
        // Clear the current request after a short delay
        setTimeout(() => {
          currentCheckRequest = null;
        }, 50);
      });

    return currentCheckRequest;
  } catch (error) {
    console.error('Error in hasWhitelistedAddressesAsync:', error);
    return true; // Default to restricted mode
  }
}

/**
 * Synchronous version that uses cached result
 */
export function hasWhitelistedAddresses(): boolean {
  // Check cache first
  const now = Date.now();
  if (publicModeCache.value !== null && (now - publicModeCache.timestamp) < CACHE_TTL) {
    return !publicModeCache.value;
  }

  // If on server, use direct implementation
  if (isServer) {
    const isPublic = serverWhitelist.isPublicMode();
    publicModeCache = {
      value: isPublic,
      timestamp: now
    };
    return !isPublic;
  }

  // On client with no cache, trigger async update
  hasWhitelistedAddressesAsync().catch(console.error);

  // Default to restricted mode for safety if no cached data
  return publicModeCache.value === null ? true : !publicModeCache.value;
}

/**
 * Check if a wallet address is allowed to access the application
 */
export async function isAddressAllowedAsync(address: string | null | undefined): Promise<boolean> {
  if (!address) return false;

  try {
    // Check cache first
    const now = Date.now();
    const cached = addressValidationCache.get(address);
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      return cached.isAllowed;
    }

    // If we have a definitive public mode cache and it's true, all addresses are allowed
    if (publicModeCache.value === true && (now - publicModeCache.timestamp) < CACHE_TTL) {
      addressValidationCache.set(address, { isAllowed: true, timestamp: now });
      return true;
    }

    // If running on server, use direct implementation
    if (isServer) {
      const isAllowed = serverWhitelist.isAddressAllowed(address);
      addressValidationCache.set(address, {
        isAllowed,
        timestamp: now
      });
      return isAllowed;
    }

    // On client, use API with request deduplication
    if (currentAddressRequests.has(address)) {
      return currentAddressRequests.get(address)!;
    }

    // Create controller for abort
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout

    // Create a new request and store the promise
    const addressRequest = fetch('/api/auth/validate-address', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
      signal: controller.signal
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to validate address: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Cache result
        addressValidationCache.set(address, {
          isAllowed: data.isAllowed,
          timestamp: now
        });
        return data.isAllowed;
      })
      .catch(error => {
        if (error.name === 'AbortError') {
          console.warn('Address validation request aborted due to timeout');

          // *** CRITICAL CHANGE FOR LOGGED-IN USERS ***
          // If we have a stored token, assume the address is allowed
          // This helps already authenticated users not get stuck on refresh
          if (typeof window !== 'undefined' && localStorage.getItem('auth-token')) {
            console.info('User has auth token, assuming address is allowed despite timeout');
            addressValidationCache.set(address, {
              isAllowed: true,
              timestamp: now - (CACHE_TTL - 60000) // Cache for 1 minute only on timeout
            });
            return true;
          }
        } else {
          console.error('Error validating address:', error);
        }

        return false; // Default to not allowed for safety
      })
      .finally(() => {
        clearTimeout(timeoutId);
        // Remove from in-progress map after a short delay
        setTimeout(() => {
          currentAddressRequests.delete(address);
        }, 50);
      });

    // Store the promise
    currentAddressRequests.set(address, addressRequest);
    return addressRequest;
  } catch (error) {
    console.error('Error in isAddressAllowedAsync:', error);
    return false;
  }
}

/**
 * Synchronous version that uses cached result
 */
export function isAddressAllowed(address: string | null | undefined): boolean {
  if (!address) return false;

  const now = Date.now();

  // Check cache first
  const cached = addressValidationCache.get(address);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.isAllowed;
  }

  // If we have public mode cached as true, all addresses are allowed
  if (publicModeCache.value === true && (now - publicModeCache.timestamp) < CACHE_TTL) {
    addressValidationCache.set(address, { isAllowed: true, timestamp: now });
    return true;
  }

  // If on server, use direct implementation
  if (isServer) {
    const isAllowed = serverWhitelist.isAddressAllowed(address);
    addressValidationCache.set(address, {
      isAllowed,
      timestamp: now
    });
    return isAllowed;
  }

  // On client with no cache, trigger async update
  isAddressAllowedAsync(address).catch(console.error);

  // Default to not allowed if we have no cached data yet
  return false;
}

// Empty array for backward compatibility
export const ALLOWED_ADDRESSES: readonly string[] = [];
