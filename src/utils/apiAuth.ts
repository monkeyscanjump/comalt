import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/utils/auth';
import { isPublicMode } from '@/lib/whitelist-server';

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

  if (!token) {
    console.log('[API Auth] No token provided');
    return {
      authenticated: false,
      publicMode,
      error: NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    };
  }

  // Verify the token
  const payload = verifyToken(token);
  if (!payload) {
    console.log('[API Auth] Invalid token');
    return {
      authenticated: false,
      publicMode,
      error: NextResponse.json({ error: 'Invalid token' }, { status: 401 })
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
      error: NextResponse.json({ error: 'Admin privileges required' }, { status: 403 })
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
  details?: any,
  status = 500
): NextResponse {
  return createApiResponse(
    {
      error: message,
      details: details || undefined
    },
    status
  );
}
