export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAddressAllowed } from '@/config/whitelist';
import { getCachedToken, setCachedToken } from '@/services/tokenCache';
import { getAuthToken, validateAuthToken, isTokenExpired } from '@/utils/api';
import { withApiRoute } from '@/middlewares/withApiRoute';
import jwt from 'jsonwebtoken';

/**
 * Handle token verification
 */
const handleVerifyToken = async (request: NextRequest) => {
  // CRITICAL: Check for known token expiration FIRST, before getting or validating token
  if (isTokenExpired()) {
    console.log('[Wallet API] Token already known to be expired, rejecting request');
    const error = new Error('Token expired');
    (error as any).code = 'TOKEN_EXPIRED';
    (error as any).status = 401;
    throw error;
  }

  // Get token from Authorization header
  const token = getAuthToken(request);

  if (!token) {
    const error = new Error('No token provided');
    (error as any).code = 'TOKEN_MISSING';
    (error as any).status = 401;
    throw error;
  }

  // Basic format validation first
  if (!token.includes('.') || token.split('.').length !== 3) {
    const error = new Error('Invalid token format');
    (error as any).code = 'INVALID_FORMAT';
    (error as any).status = 401;
    throw error;
  }

  // Check cache first for better performance
  const cachedResult = getCachedToken(token);
  if (cachedResult) {
    console.log('[Wallet API] Using cached token verification result');
    return NextResponse.json({
      valid: cachedResult.valid,
      address: cachedResult.address,
      userId: cachedResult.userId,
      allowed: cachedResult.allowed,
      isAdmin: cachedResult.isAdmin
    });
  }

  // Verify the token
  let tokenResult;
  try {
    tokenResult = await validateAuthToken(token);
  } catch (tokenError) {
    // Check if this is a token expiration error
    if (tokenError instanceof jwt.TokenExpiredError ||
        (tokenError instanceof Error && tokenError.message.includes('expired'))) {
      const error = new Error('Token expired');
      (error as any).code = 'TOKEN_EXPIRED';
      (error as any).status = 401;
      throw error;
    }

    const error = new Error('Token validation failed');
    (error as any).code = 'TOKEN_VALIDATION_ERROR';
    (error as any).status = 401;
    (error as any).details = {
      message: tokenError instanceof Error ? tokenError.message : String(tokenError)
    };
    throw error;
  }

  if (!tokenResult.valid) {
    const error = new Error(tokenResult.error || 'Invalid token');
    (error as any).code = tokenResult.errorCode || 'TOKEN_INVALID';
    (error as any).status = 401;
    throw error;
  }

  // Try to get user information from session
  let sessionUser = null;
  try {
    // Lookup the session
    const session = await prisma.session.findFirst({
      where: { token },
      include: { user: true }
    });

    if (session) {
      if (session.expiresAt < new Date()) {
        const error = new Error('Session expired');
        (error as any).code = 'SESSION_EXPIRED';
        (error as any).status = 401;
        throw error;
      }

      sessionUser = session.user;
    }
  } catch (dbError) {
    console.error('[Wallet API] Session lookup failed:', dbError);
    // Continue even if session lookup fails
  }

  // Either use session user info or token info
  const userId = sessionUser?.id || tokenResult.userId;
  const address = sessionUser?.address || tokenResult.address;
  const isAdmin = sessionUser?.isAdmin || tokenResult.isAdmin || false;

  // Double check if address is still allowed
  const allowed = isAddressAllowed(address || '');

  // Cache the result for future requests
  setCachedToken(token, {
    valid: true,
    address: address || '',
    userId: userId || '',
    allowed,
    isAdmin
  });

  // Return verification result
  return NextResponse.json({
    valid: true,
    address,
    userId,
    allowed,
    isAdmin
  });
};

// Export the GET handler with the API route wrapper
export const GET = withApiRoute(handleVerifyToken, {
  // No authentication required for verify endpoint
  // No rate limiting for verify endpoint since it's called frequently
});
