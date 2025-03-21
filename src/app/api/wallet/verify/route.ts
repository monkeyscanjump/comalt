export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isAddressAllowed } from '@/config/whitelist';
import { getCachedToken, setCachedToken } from '@/services/tokenCache';
import {
  errorResponse,
  getAuthToken,
  validateAuthToken
} from '@/utils/api';

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const token = getAuthToken(request);

    if (!token) {
      return errorResponse('No token provided', 'TOKEN_MISSING', 401);
    }

    // Basic format validation first
    if (!token.includes('.') || token.split('.').length !== 3) {
      return errorResponse('Invalid token format', 'INVALID_FORMAT', 401);
    }

    // Check cache first for better performance
    const cachedResult = getCachedToken(token);
    if (cachedResult) {
      console.log('Using cached token verification result');
      return NextResponse.json({
        valid: cachedResult.valid,
        address: cachedResult.address,
        userId: cachedResult.userId,
        allowed: cachedResult.allowed,
        isAdmin: cachedResult.isAdmin
      });
    }

    // Verify the token
    const tokenResult = await validateAuthToken(token);

    if (!tokenResult.valid) {
      return errorResponse(
        tokenResult.error || 'Invalid token',
        tokenResult.errorCode || 'TOKEN_INVALID',
        401
      );
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
          return errorResponse('Session expired', 'SESSION_EXPIRED', 401);
        }

        sessionUser = session.user;
      }
    } catch (dbError) {
      console.error('Session lookup failed:', dbError);
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
  } catch (error) {
    console.error('Token verification error:', error);
    return errorResponse(
      'Verification failed',
      'VERIFICATION_FAILED',
      500,
      { message: error instanceof Error ? error.message : String(error) }
    );
  }
}
