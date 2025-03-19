export interface TokenCacheEntry {
  valid: boolean;
  address: string;
  userId: string;
  allowed: boolean;
  isAdmin: boolean;
  timestamp: number;
}

// Declare global token cache type
declare global {
  var tokenCache: Map<string, TokenCacheEntry> | undefined;
}
