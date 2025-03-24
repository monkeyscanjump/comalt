import { TokenCacheEntry } from "@/types/auth";

// Add TypeScript global augmentation to avoid 'Property tokenCache does not exist on type Global' error
declare global {
  var tokenCache: Map<string, TokenCacheEntry> | undefined;
}

// Initialize the global token cache if it doesn't exist
if (!global.tokenCache) {
  global.tokenCache = new Map<string, TokenCacheEntry>();
}

// Cache TTL
export const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Get the global token cache map
 */
export function getTokenCache(): Map<string, TokenCacheEntry> {
  return global.tokenCache!;
}

/**
 * Get cached token data if it exists and is not expired
 * @param token JWT token to look up
 * @returns The cached token entry or undefined if not found or expired
 */
export function getCachedToken(token: string): TokenCacheEntry | undefined {
  if (!token) return undefined;

  // Basic validation that it's a JWT token
  if (!token.includes('.') || token.split('.').length !== 3) {
    console.warn('Invalid token format requested from cache');
    return undefined;
  }

  const cache = getTokenCache();
  const entry = cache.get(token);

  // Return entry if it exists and hasn't expired
  if (entry && (Date.now() - entry.timestamp) < CACHE_TTL) {
    return entry;
  }

  // If entry has expired, clean it up
  if (entry) {
    clearCachedToken(token);
  }

  return undefined;
}

/**
 * Store token data in the cache
 * @param token JWT token to cache
 * @param data Token data to store
 */
export function setCachedToken(token: string, data: Omit<TokenCacheEntry, 'timestamp'>): void {
  if (!token) return;

  // Basic validation that it's a JWT token
  if (!token.includes('.') || token.split('.').length !== 3) {
    console.warn('Attempted to cache invalid token format');
    return;
  }

  const cache = getTokenCache();
  cache.set(token, {
    ...data,
    timestamp: Date.now()
  });
}

/**
 * Remove a token from the cache
 * @param token JWT token to remove
 */
export function clearCachedToken(token: string): void {
  if (!token) return;
  const cache = getTokenCache();
  cache.delete(token);
}

/**
 * Alias for clearCachedToken to maintain backward compatibility
 * Used by the token refresh endpoint
 */
export function removeCachedToken(token: string): void {
  clearCachedToken(token);
}

/**
 * Clean expired entries from the token cache
 * Can be called periodically to prevent memory leaks
 */
export function cleanExpiredTokens(): void {
  const cache = getTokenCache();
  const now = Date.now();

  // Use Array.from instead of direct iteration to avoid downlevelIteration issues
  Array.from(cache.keys()).forEach(token => {
    const entry = cache.get(token);
    if (entry && now - entry.timestamp >= CACHE_TTL) {
      cache.delete(token);
    }
  });
}

/**
 * Get the current size of the token cache
 * Useful for monitoring
 */
export function getTokenCacheSize(): number {
  return getTokenCache().size;
}
