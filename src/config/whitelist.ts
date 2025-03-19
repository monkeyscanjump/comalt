/**
 * Whitelist configuration
 * This uses server-side API calls to check whitelist status securely
 */

// Cache for public mode status
let publicModeCache: { value: boolean | null; timestamp: number } = {
  value: null,
  timestamp: 0
};

// Cache for address validation results
const addressValidationCache = new Map<string, { isAllowed: boolean; timestamp: number }>();

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

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

    const response = await fetch('/api/auth/check-mode/');
    if (!response.ok) {
      console.error('Error checking whitelist mode:', await response.text());
      throw new Error('Failed to check whitelist mode');
    }

    const data = await response.json();
    console.log('Public mode check response:', data);

    // Update cache
    publicModeCache = {
      value: data.isPublicMode,
      timestamp: now
    };

    return !data.isPublicMode;
  } catch (error) {
    console.error('Error checking whitelist mode:', error);
    // Assume restricted mode by default for safety
    return true;
  }
}

/**
 * Synchronous version that uses cached result
 */
export function hasWhitelistedAddresses(): boolean {
  // Use cached value if available and not expired
  const now = Date.now();
  if (publicModeCache.value !== null && (now - publicModeCache.timestamp) < CACHE_TTL) {
    return !publicModeCache.value;
  }

  // Trigger async check to update cache
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

    const response = await fetch('/api/auth/validate-address/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address })
    });

    if (!response.ok) {
      console.error('Error validating address:', await response.text());
      throw new Error('Failed to validate address');
    }

    const data = await response.json();
    console.log('Address validation response:', data);

    // Cache result
    addressValidationCache.set(address, {
      isAllowed: data.isAllowed,
      timestamp: now
    });

    return data.isAllowed;
  } catch (error) {
    console.error('Error validating address:', error);
    return false; // Default to not allowed for safety
  }
}

/**
 * Synchronous version that uses cached result
 */
export function isAddressAllowed(address: string | null | undefined): boolean {
  if (!address) return false;

  const now = Date.now();

  // Use cached value if available and not expired
  const cached = addressValidationCache.get(address);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.isAllowed;
  }

  // If we have a definitive public mode cache and it's true, all addresses are allowed
  if (publicModeCache.value === true && (now - publicModeCache.timestamp) < CACHE_TTL) {
    addressValidationCache.set(address, { isAllowed: true, timestamp: now });
    return true;
  }

  // Trigger async check to update cache
  isAddressAllowedAsync(address).catch(console.error);

  // Default to not allowed if we have no cached data yet
  return false;
}

// Empty array for backward compatibility
export const ALLOWED_ADDRESSES: readonly string[] = [];
