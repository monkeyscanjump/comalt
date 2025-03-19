import { TokenCacheEntry } from "@/types/tokenCache";

// Initialize the global token cache if it doesn't exist
if (!global.tokenCache) {
  global.tokenCache = new Map<string, TokenCacheEntry>();
}

// Cache TTL
export const CACHE_TTL = 60 * 1000; // 1 minute

export function getTokenCache(): Map<string, TokenCacheEntry> {
  return global.tokenCache!;
}

export function getCachedToken(token: string): TokenCacheEntry | undefined {
  const cache = getTokenCache();
  const entry = cache.get(token);
  if (entry && (Date.now() - entry.timestamp) < CACHE_TTL) {
    return entry;
  }
  return undefined;
}

export function setCachedToken(token: string, data: Omit<TokenCacheEntry, 'timestamp'>): void {
  const cache = getTokenCache();
  cache.set(token, {
    ...data,
    timestamp: Date.now()
  });
}

export function clearCachedToken(token: string): void {
  const cache = getTokenCache();
  cache.delete(token);
}
