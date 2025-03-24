/**
 * JWT Token payload structure
 */
export interface TokenPayload {
  sub: string;          // User ID (subject)
  address: string;      // Wallet address
  userId?: string;      // Optional alias for sub for clearer API usage
  isAdmin?: boolean;    // Admin status flag
  iat?: number;         // Issued at timestamp
  exp?: number;         // Expiration timestamp
}

/**
 * Token cache entry for performance optimization
 */
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
