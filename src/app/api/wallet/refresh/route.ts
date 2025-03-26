export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/utils/auth';
import { clearCachedToken } from '@/services/tokenCache';
import { getAuthToken, setTokenExpired } from '@/utils/api';
import { isAddressAllowed } from '@/config/whitelist';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { withApiRoute } from '@/middlewares/withApiRoute';
import { AuthService } from '@/services/authService';

/**
 * Handle token refresh
 */
const handleTokenRefresh = async (request: NextRequest) => {
  console.log('[Refresh API] Token refresh request received');

  // CRITICAL: Get the token but DON'T check if it's expired!
  // We specifically want to allow expired tokens in this endpoint!
  const token = getAuthToken(request);

  if (!token) {
    console.log('[Refresh API] No token provided');
    const error = new Error('Missing or invalid token');
    (error as any).code = 'TOKEN_MISSING';
    (error as any).status = 401;
    throw error;
  }

  // Basic format validation - JWT tokens have format: header.payload.signature
  if (!token.includes('.') || token.split('.').length !== 3) {
    console.log('[Refresh API] Invalid token format');
    const error = new Error('Invalid token format');
    (error as any).code = 'INVALID_TOKEN_FORMAT';
    (error as any).status = 401;
    throw error;
  }

  // Get user data from the token - BUT handle the expired case!
  let userData;
  let address;

  try {
    // Try to get data from token, this might fail if token is expired
    userData = verifyToken(token, true); // Pass true to skip expiration check
    address = userData?.address;
  } catch (tokenError) {
    console.log('[Refresh API] Token validation error:', tokenError);

    // For expired tokens, try to extract the address from the payload
    // without validation
    if (tokenError instanceof jwt.TokenExpiredError) {
      console.log('[Refresh API] Token expired, extracting payload without validation');

      try {
        // Decode without verification to get payload
        const parts = token.split('.');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        address = payload.address;
        console.log(`[Refresh API] Successfully extracted address from expired token: ${address}`);
      } catch (decodeError) {
        console.error('[Refresh API] Failed to decode expired token:', decodeError);
        const error = new Error('Failed to extract data from expired token');
        (error as any).code = 'TOKEN_DECODE_ERROR';
        (error as any).status = 401;
        throw error;
      }
    } else {
      // For other validation errors, fail
      const error = new Error('Invalid token');
      (error as any).code = 'INVALID_TOKEN';
      (error as any).status = 401;
      (error as any).details = {
        message: tokenError instanceof Error ? tokenError.message : String(tokenError)
      };
      throw error;
    }
  }

  if (!address) {
    console.log('[Refresh API] No address found in token');
    const error = new Error('No address found in token');
    (error as any).code = 'NO_ADDRESS';
    (error as any).status = 401;
    throw error;
  }

  // Check if address is still allowed
  const allowed = await isAddressAllowed(address);
  if (!allowed) {
    console.log(`[Refresh API] Address ${address} is no longer allowed`);
    const error = new Error('Address no longer allowed');
    (error as any).code = 'ADDRESS_NOT_ALLOWED';
    (error as any).status = 403;
    throw error;
  }

  console.log(`[Refresh API] Address ${address} is allowed, refreshing session`);

  // Find user in database
  let user;
  try {
    user = await prisma.user.findUnique({
      where: { address }
    });
  } catch (dbError) {
    console.error('[Refresh API] Database error:', dbError);
    // Continue even if DB lookup fails
  }

  // Use AuthService to refresh the token
  console.log('[Refresh API] Calling AuthService.refreshToken');
  const newToken = await AuthService.refreshToken(token);

  if (!newToken) {
    console.log('[Refresh API] Failed to refresh token');
    const error = new Error('Failed to refresh token');
    (error as any).code = 'REFRESH_FAILED';
    (error as any).status = 401;
    throw error;
  }

  // Clear the old token from cache
  clearCachedToken(token);

  // VERY IMPORTANT: Mark token as NOT expired globally
  // This is already done in AuthService.refreshToken, but we do it here again for safety
  setTokenExpired(false);

  console.log('[Refresh API] Token refreshed successfully');

  // Return the new token with user data
  return NextResponse.json({
    token: newToken,
    success: true,
    // Add user data to the response to maintain user state
    user: {
      id: user?.id || address,
      address: address,
      isAdmin: user?.isAdmin || false
    }
  });
};

// Export the POST handler with the proper wrapper
export const POST = withApiRoute(handleTokenRefresh);
