import { NextRequest, NextResponse } from 'next/server';
import { cryptoWaitReady, signatureVerify } from '@polkadot/util-crypto';
import { isAddressAllowed } from '@/config/whitelist';
import { extractTokenFromHeader, verifyToken } from '@/utils/auth';

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  error: string;
  errorCode: string;
  message?: string;
  [key: string]: any;
}

/**
 * Creates a standardized error response with consistent formatting
 * @param error Human-readable error message
 * @param errorCode Machine-readable error code
 * @param status HTTP status code
 * @param additionalData Additional properties to include in response
 * @returns Formatted NextResponse object
 */
export function errorResponse(
  error: string,
  errorCode: string,
  status = 400,
  additionalData: Record<string, any> = {}
): NextResponse {
  const errorBody: ApiErrorResponse = {
    error,
    errorCode,
    ...additionalData
  };

  return NextResponse.json(errorBody, { status });
}

/**
 * Safely extracts and parses the request body as JSON
 * @param request The incoming request object
 * @returns Parsed body object or null if parsing fails
 */
export async function parseRequestBody<T extends object>(request: NextRequest): Promise<T | null> {
  try {
    return await request.json();
  } catch (error) {
    console.error('Failed to parse request body:', error);
    return null;
  }
}

/**
 * In-memory storage for rate limiting data, isolated by route
 */
const rateLimiters = new Map<string, Map<string, { count: number, timestamp: number }>>();

/**
 * Implements basic rate limiting for API routes
 * @param request The incoming request object
 * @param routeName Identifier for the route being limited
 * @param windowMs Time window for rate limiting in milliseconds
 * @param maxRequests Maximum allowed requests per window
 * @returns Object indicating if request is allowed and retry time if not
 */
export function checkRateLimit(
  request: NextRequest,
  routeName: string,
  windowMs = 60 * 1000, // 1 minute default
  maxRequests = 10 // 10 requests per minute default
): { allowed: boolean; retryAfter?: number } {
  // Get client IP
  const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();

  // Get or create rate limiter for this route
  if (!rateLimiters.has(routeName)) {
    rateLimiters.set(routeName, new Map());
  }

  const routeLimiter = rateLimiters.get(routeName)!;
  const clientRequests = routeLimiter.get(clientIp);

  if (clientRequests) {
    // Reset count if window has passed
    if (now - clientRequests.timestamp > windowMs) {
      routeLimiter.set(clientIp, { count: 1, timestamp: now });
      return { allowed: true };
    } else if (clientRequests.count >= maxRequests) {
      // Too many requests
      const retryAfter = Math.ceil((clientRequests.timestamp + windowMs - now) / 1000);
      return { allowed: false, retryAfter };
    } else {
      // Increment count
      routeLimiter.set(clientIp, {
        count: clientRequests.count + 1,
        timestamp: clientRequests.timestamp
      });
      return { allowed: true };
    }
  } else {
    // First request
    routeLimiter.set(clientIp, { count: 1, timestamp: now });
    return { allowed: true };
  }
}

/**
 * Creates a standardized rate limit exceeded response
 * @param retryAfter Seconds until client can retry
 * @returns Formatted NextResponse object
 */
export function rateLimitResponse(retryAfter: number): NextResponse {
  return errorResponse(
    'Too many requests',
    'RATE_LIMIT_EXCEEDED',
    429,
    { retryAfter }
  );
}

/**
 * Verifies a wallet signature using multiple crypto algorithms
 * Tries sr25519, ed25519, and ecdsa in sequence to maximize compatibility
 * @param message The message that was signed
 * @param signature The signature to verify
 * @param address The wallet address that supposedly signed the message
 * @returns Object with validity result and crypto method used
 */
export async function verifyWalletSignature(
  message: string,
  signature: string,
  address: string
): Promise<{ isValid: boolean; method: string }> {
  await cryptoWaitReady();

  // Try sr25519 (most common in Polkadot)
  try {
    const sr25519Result = (signatureVerify as any)(message, signature, address, 'sr25519');
    if (sr25519Result.isValid) {
      return { isValid: true, method: 'sr25519' };
    }
  } catch (error) {
    console.log('sr25519 verification error:', error instanceof Error ? error.message : String(error));
  }

  // Try ed25519
  try {
    const ed25519Result = (signatureVerify as any)(message, signature, address, 'ed25519');
    if (ed25519Result.isValid) {
      return { isValid: true, method: 'ed25519' };
    }
  } catch (error) {
    console.log('ed25519 verification error:', error instanceof Error ? error.message : String(error));
  }

  // Try ecdsa as last resort
  try {
    const ecdsaResult = (signatureVerify as any)(message, signature, address, 'ecdsa');
    if (ecdsaResult.isValid) {
      return { isValid: true, method: 'ecdsa' };
    }
  } catch (error) {
    console.log('ecdsa verification error:', error instanceof Error ? error.message : String(error));
  }

  // No valid signature found
  return { isValid: false, method: 'none' };
}

/**
 * Validates if a wallet address is allowed to access the system
 * Checks against configured whitelist when enabled
 * @param address Wallet address to validate
 * @returns Object indicating if address is allowed
 */
export function validateWalletAccess(address: string) {
  if (!address) {
    return { allowed: false };
  }

  // Get whitelist from environment
  const allowedWallets = process.env.ALLOWED_WALLETS || '';
  const allowedAddresses = allowedWallets.split(',').map(addr => addr.trim()).filter(Boolean);

  // If whitelist is empty, all addresses are allowed
  const isPublicMode = allowedAddresses.length === 0;

  // Check if address is in whitelist or if in public mode
  const allowed = isPublicMode || allowedAddresses.includes(address);

  console.log(`Wallet access check - Address: ${address}, Public mode: ${isPublicMode}, Allowed: ${allowed}`);

  return { allowed, isPublicMode };
}

/**
 * Validates an authentication token and extracts user data
 * @param token JWT token to validate
 * @returns Object with validation results and user data if valid
 */
export async function validateAuthToken(token: string): Promise<{
  valid: boolean;
  address?: string;
  userId?: string;
  allowed?: boolean;
  isAdmin?: boolean;
  error?: string;
  errorCode?: string;
}> {
  try {
    // Get payload from token
    const payload = verifyToken(token);

    if (!payload || !payload.sub) {
      console.log('Invalid token payload:', payload);
      return {
        valid: false,
        error: 'Invalid token',
        errorCode: 'TOKEN_INVALID'
      };
    }

    // Return the token data
    return {
      valid: true,
      address: payload.address,
      userId: payload.sub,
      isAdmin: payload.isAdmin
    };
  } catch (error) {
    console.error('Token validation error:', error);
    return {
      valid: false,
      error: 'Failed to validate token',
      errorCode: 'TOKEN_VALIDATION_ERROR'
    };
  }
}

/**
 * Extracts authentication token from request headers
 * @param request The incoming request object
 * @returns Extracted token or null if not present
 */
export function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  return extractTokenFromHeader(authHeader);
}
