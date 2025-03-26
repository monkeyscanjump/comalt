import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/utils/auth';
import { isAddressAllowed } from '@/config/whitelist';
import { getCachedToken, setCachedToken } from '@/services/tokenCache';
import jwt from 'jsonwebtoken';

// Global token expiration state - will block all API requests when true
let isTokenGloballyExpired = false;

/**
 * Check if the token is known to be expired
 */
export function isTokenExpired(): boolean {
  return isTokenGloballyExpired;
}

/**
 * Set the global token expiration state
 */
export function setTokenExpired(expired: boolean): void {
  // Only log when the state changes
  if (isTokenGloballyExpired !== expired) {
    console.log(`[API] Token expired state set to: ${expired}`);
  }
  isTokenGloballyExpired = expired;
}

// Global API error handler for token expiration detection
let globalApiErrorHandler: ((error: any) => any) | null = null;

/**
 * Register a global error handler for API responses
 * This is called from AuthProvider to connect handleApiError
 */
export function registerApiErrorHandler(handler: (error: any) => any): void {
  globalApiErrorHandler = handler;
}

/**
 * Process an API error through the global handler
 * Returns the error for chaining
 */
export function processApiError(error: any): any {
  // Check for token expiration patterns directly
  const isExpiredToken =
    (error?.status === 401 && error?.errorCode === 'TOKEN_EXPIRED') ||
    (error?.data?.errorCode === 'TOKEN_EXPIRED') ||
    (error instanceof jwt.TokenExpiredError) ||
    (error?.message && (
      error.message.includes('token expired') ||
      error.message.includes('Invalid token') ||
      error.message.includes('jwt expired')
    ));

  if (isExpiredToken) {
    console.warn('[API] Token expiration detected in error handler');
    setTokenExpired(true);
  }

  // Pass to registered handler
  if (globalApiErrorHandler) {
    return globalApiErrorHandler(error);
  }
  return error;
}

// Rate limiting
type RateLimitRequest = {
  ip: string;
  timestamp: number;
};

// Store rate limit requests in memory
// Key is endpoint, value is array of requests
const rateLimitStore: Record<string, RateLimitRequest[]> = {};

/**
 * Check if a request should be rate limited
 */
export function checkRateLimit(
  request: NextRequest,
  endpoint: string,
  windowMs: number,
  maxRequests: number
): { allowed: boolean; retryAfter?: number } {
  // Get client IP
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : request.ip || '127.0.0.1';

  // Initialize store for this endpoint if not exists
  if (!rateLimitStore[endpoint]) {
    rateLimitStore[endpoint] = [];
  }

  // Get current time
  const now = Date.now();

  // Clean up old requests outside the window
  rateLimitStore[endpoint] = rateLimitStore[endpoint].filter(
    (req) => now - req.timestamp < windowMs
  );

  // Count requests from this IP in the window
  const recentRequests = rateLimitStore[endpoint].filter(
    (req) => req.ip === ip
  );

  // If too many requests, return false
  if (recentRequests.length >= maxRequests) {
    // Calculate when the oldest request will expire
    const oldestRequest = recentRequests[0];
    const retryAfter = Math.ceil((oldestRequest.timestamp + windowMs - now) / 1000);

    return {
      allowed: false,
      retryAfter: retryAfter > 0 ? retryAfter : 1
    };
  }

  // Record this request
  rateLimitStore[endpoint].push({ ip, timestamp: now });

  return { allowed: true };
}

/**
 * Return a rate limit exceeded response
 */
export function rateLimitResponse(
  retryAfter: number
): NextResponse {
  return NextResponse.json(
    {
      error: 'Too many requests, please try again later',
      errorCode: 'RATE_LIMIT_EXCEEDED'
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        'X-Rate-Limit-Limit': 'Too many requests',
      },
    }
  );
}

/**
 * Parse request body with proper error handling
 */
export async function parseRequestBody<T = any>(
  request: NextRequest
): Promise<T | null> {
  try {
    return await request.json();
  } catch (error) {
    console.error('Failed to parse request body:', error);
    return null;
  }
}

/**
 * Return a standardized error response
 */
export function errorResponse(
  message: string,
  errorCode: string,
  status: number,
  details?: Record<string, any>
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      errorCode,
      ...(details || {})
    },
    { status }
  );
}

/**
 * Verify that a wallet signature is valid
 */
export async function verifyWalletSignature(
  message: string,
  signature: string,
  address: string
): Promise<{ isValid: boolean; method: string }> {
  try {
    // For now, we'll just return true - implement actual verification later
    return { isValid: true, method: 'mock-verification' };
  } catch (error) {
    console.error('Signature verification error:', error);
    return { isValid: false, method: 'failed' };
  }
}

/**
 * Validate if a wallet address is allowed to access the system
 */
export function validateWalletAccess(address: string): {
  allowed: boolean;
  isPublicMode: boolean;
} {
  // Check if address is allowed by the whitelist
  const allowed = isAddressAllowed(address);

  // Determine if we're in public mode (no whitelist)
  const isPublicMode = !address;

  return { allowed, isPublicMode };
}

/**
 * Extract token from request
 */
export function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  return extractTokenFromHeader(authHeader);
}

/**
 * Check token without throwing any errors - safer version that won't trigger JWT exceptions
 * This is used for pre-verification to prevent unnecessary JWT errors
 */
export function isValidTokenFormat(token: string): boolean {
  if (!token) return false;

  // Basic format check
  if (!token.includes('.') || token.split('.').length !== 3) {
    return false;
  }

  // Try to decode without verification
  try {
    const parts = token.split('.');
    const decodedPayload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString()
    );

    // Check if expired
    if (decodedPayload.exp) {
      const now = Math.floor(Date.now() / 1000);
      if (decodedPayload.exp < now) {
        // Token is expired - set global flag immediately
        setTokenExpired(true);
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validates an authentication token
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
    // CRITICAL: Check if we already know the token is expired globally FIRST
    if (isTokenGloballyExpired) {
      console.log('[API] Skipping token validation - token already known to be expired');
      return {
        valid: false,
        error: 'Token expired (globally flagged)',
        errorCode: 'TOKEN_EXPIRED'
      };
    }

    if (!token) {
      return {
        valid: false,
        error: 'No token provided',
        errorCode: 'TOKEN_MISSING'
      };
    }

    // Pre-check token format and expiration without throwing errors
    if (!isValidTokenFormat(token)) {
      return {
        valid: false,
        error: 'Invalid token format or expired',
        errorCode: 'TOKEN_INVALID'
      };
    }

    // Check cache first - this avoids unnecessary JWT verification
    const cachedResult = getCachedToken(token);
    if (cachedResult) {
      return {
        valid: cachedResult.valid,
        address: cachedResult.address,
        userId: cachedResult.userId,
        allowed: cachedResult.allowed,
        isAdmin: cachedResult.isAdmin
      };
    }

    // At this point we've done all the safe checks, now we verify the token which could throw
    // Verify the token
    const decoded = verifyToken(token);
    if (!decoded) {
      return {
        valid: false,
        error: 'Invalid token',
        errorCode: 'TOKEN_INVALID'
      };
    }

    // Check if wallet is still allowed
    const allowed = isAddressAllowed(decoded.address);

    // Create result
    const result = {
      valid: true,
      address: decoded.address,
      userId: decoded.sub,
      allowed,
      isAdmin: decoded.isAdmin || false
    };

    // Cache result for future requests
    setCachedToken(token, result);

    return result;
  } catch (error) {
    console.error('Token validation error:', error);

    // Handle specific JWT errors
    if (error instanceof jwt.TokenExpiredError) {
      // CRITICAL: Mark token as expired globally IMMEDIATELY
      setTokenExpired(true);

      // Process through global error handler
      processApiError({
        status: 401,
        errorCode: 'TOKEN_EXPIRED',
        message: 'Token expired'
      });

      return {
        valid: false,
        error: 'Token expired',
        errorCode: 'TOKEN_EXPIRED'
      };
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return {
        valid: false,
        error: 'Invalid token',
        errorCode: 'TOKEN_INVALID'
      };
    }

    // Process through global error handler for any other errors
    processApiError(error);

    return {
      valid: false,
      error: 'Token validation failed',
      errorCode: 'VALIDATION_ERROR'
    };
  }
}
