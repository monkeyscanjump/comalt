import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/utils/auth';
import { isPublicMode } from '@/lib/whitelist-server';
import { processApiError, isTokenExpired } from '@/utils/api';
import jwt from 'jsonwebtoken';

interface AuthResult {
  authenticated: boolean;
  publicMode: boolean;
  error?: NextResponse;
  payload?: any;
  userId?: string;
  isAdmin?: boolean;
}

/**
 * Authenticate an API request - handles both token auth and public mode
 *
 * @param request The Next.js request object
 * @param requireAdmin Whether admin privileges are required (default: false)
 * @returns Authentication result object
 *
 * Usage example:
 * ```
 * const authResult = await authenticateRequest(request);
 * if (authResult.error) return authResult.error;
 * // Request is authenticated, continue processing
 * ```
 */
export async function authenticateRequest(
  request: NextRequest,
  requireAdmin = false
): Promise<AuthResult> {
  // Check if app is in public mode
  const publicMode = isPublicMode();
  console.log('[API Auth] Public mode:', publicMode);

  // If in public mode and we don't require admin, authentication succeeds
  if (publicMode && !requireAdmin) {
    console.log('[API Auth] Public mode enabled, skipping authentication');
    return {
      authenticated: true,
      publicMode: true
    };
  }

  // Otherwise, verify token authentication
  const authHeader = request.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader);

  // NEW: Check if token is already known to be expired (client-side check)
  if (isTokenExpired() && token) {
    console.log('[API Auth] Token already known to be expired, rejecting request');
    const errorResponse = NextResponse.json({
      error: 'Token expired',
      errorCode: 'TOKEN_EXPIRED'
    }, { status: 401 });

    return {
      authenticated: false,
      publicMode,
      error: errorResponse
    };
  }

  if (!token) {
    console.log('[API Auth] No token provided');
    return {
      authenticated: false,
      publicMode,
      error: NextResponse.json({
        error: 'Authentication required',
        errorCode: 'AUTH_REQUIRED'
      }, { status: 401 })
    };
  }

  try {
    // Verify the token
    const payload = verifyToken(token);
    if (!payload) {
      console.log('[API Auth] Invalid token');

      // NEW: Process through global error handler
      processApiError({
        status: 401,
        errorCode: 'TOKEN_INVALID',
        message: 'Invalid token'
      });

      return {
        authenticated: false,
        publicMode,
        error: NextResponse.json({
          error: 'Invalid token',
          errorCode: 'TOKEN_INVALID'
        }, { status: 401 })
      };
    }

    // Check admin privileges if required
    if (requireAdmin && !payload.isAdmin) {
      console.log('[API Auth] Admin privileges required');
      return {
        authenticated: true, // They are authenticated, just not authorized
        publicMode,
        payload,
        userId: payload.userId,
        isAdmin: false,
        error: NextResponse.json({
          error: 'Admin privileges required',
          errorCode: 'ADMIN_REQUIRED'
        }, { status: 403 })
      };
    }

    console.log('[API Auth] Authentication successful');
    return {
      authenticated: true,
      publicMode,
      payload,
      userId: payload.userId,
      isAdmin: payload.isAdmin
    };
  } catch (error) {
    // NEW: Process through global error handler - will set global expiration flag if needed
    console.error('[API Auth] Token verification error:', error);
    processApiError(error);

    // NEW: Check for token expiration
    if (error instanceof jwt.TokenExpiredError) {
      const errorResponse = NextResponse.json({
        error: 'Token expired',
        errorCode: 'TOKEN_EXPIRED'
      }, { status: 401 });

      return {
        authenticated: false,
        publicMode,
        error: errorResponse
      };
    }

    // Default error response
    return {
      authenticated: false,
      publicMode,
      error: NextResponse.json({
        error: 'Authentication failed',
        errorCode: 'AUTH_FAILED'
      }, { status: 401 })
    };
  }
}

/**
 * Helper function to create a standard API response with cache prevention headers
 */
export function createApiResponse(data: any, status = 200): NextResponse {
  const headers = new Headers();
  headers.append('Cache-Control', 'no-cache, no-store, must-revalidate');
  headers.append('Pragma', 'no-cache');
  headers.append('Expires', '0');
  headers.append('Vary', 'Authorization');

  return NextResponse.json(data, {
    status,
    headers
  });
}

/**
 * Create a standard error response
 */
export function createErrorResponse(
  message: string,
  errorCode: string,
  status = 500,
  details?: any
): NextResponse {
  return createApiResponse(
    {
      error: message,
      errorCode,
      details: details || undefined
    },
    status
  );
}
