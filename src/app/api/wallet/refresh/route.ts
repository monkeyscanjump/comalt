export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { refreshSession, verifyToken } from '@/utils/auth';
import { clearCachedToken } from '@/services/tokenCache';
import { getAuthToken, setTokenExpired } from '@/utils/api';
import { isAddressAllowed } from '@/config/whitelist';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  console.log('[Refresh API] Token refresh request received');

  try {
    // CRITICAL: Get the token but DON'T check if it's expired!
    // We specifically want to allow expired tokens in this endpoint!
    const token = getAuthToken(request);

    if (!token) {
      console.log('[Refresh API] No token provided');
      return NextResponse.json({
        error: 'Missing or invalid token',
        errorCode: 'TOKEN_MISSING'
      }, { status: 401 });
    }

    // Basic format validation - JWT tokens have format: header.payload.signature
    if (!token.includes('.') || token.split('.').length !== 3) {
      console.log('[Refresh API] Invalid token format');
      return NextResponse.json({
        error: 'Invalid token format',
        errorCode: 'INVALID_TOKEN_FORMAT'
      }, { status: 401 });
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
          return NextResponse.json({
            error: 'Failed to extract data from expired token',
            errorCode: 'TOKEN_DECODE_ERROR'
          }, { status: 401 });
        }
      } else {
        // For other validation errors, fail
        return NextResponse.json({
          error: 'Invalid token',
          errorCode: 'INVALID_TOKEN',
          details: tokenError instanceof Error ? tokenError.message : String(tokenError)
        }, { status: 401 });
      }
    }

    if (!address) {
      console.log('[Refresh API] No address found in token');
      return NextResponse.json({
        error: 'No address found in token',
        errorCode: 'NO_ADDRESS'
      }, { status: 401 });
    }

    // Check if address is still allowed
    const allowed = await isAddressAllowed(address);
    if (!allowed) {
      console.log(`[Refresh API] Address ${address} is no longer allowed`);
      return NextResponse.json({
        error: 'Address no longer allowed',
        errorCode: 'ADDRESS_NOT_ALLOWED'
      }, { status: 403 });
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

    // Refresh the session
    console.log('[Refresh API] Calling refreshSession');
    const newToken = await refreshSession(token, address);

    if (!newToken) {
      console.log('[Refresh API] Failed to refresh token');
      return NextResponse.json({
        error: 'Failed to refresh token',
        errorCode: 'REFRESH_FAILED'
      }, { status: 401 });
    }

    // Clear the old token from cache
    clearCachedToken(token);

    // VERY IMPORTANT: Mark token as NOT expired globally
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
  } catch (error) {
    console.error('[Refresh API] Token refresh error:', error);

    return NextResponse.json(
      {
        error: 'Token refresh failed',
        errorCode: 'REFRESH_ERROR',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
