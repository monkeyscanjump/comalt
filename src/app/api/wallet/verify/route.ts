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

    // First verify the token itself is valid
    const tokenResult = await validateAuthToken(token);

    if (!tokenResult.valid) {
      return errorResponse(
        tokenResult.error || 'Invalid token',
        tokenResult.errorCode || 'TOKEN_INVALID',
        401
      );
    }

    // Look up session by token
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session) {
      console.log('Session not found');
      return errorResponse('Session not found', 'SESSION_NOT_FOUND', 401);
    }

    if (session.expiresAt < new Date()) {
      console.log('Session expired');
      return errorResponse('Session expired', 'SESSION_EXPIRED', 401);
    }

    // Check whitelist status
    const address = session.user.address;
    const allowed = isAddressAllowed(address);

    // Save to cache for future requests
    setCachedToken(token, {
      valid: true,
      address,
      userId: session.user.id,
      allowed,
      isAdmin: session.user.isAdmin || false
    });

    // Return user data along with valid status
    return NextResponse.json({
      valid: true,
      address,
      userId: session.user.id,
      allowed,
      isAdmin: session.user.isAdmin || false
    });

  } catch (error) {
    console.error('Error processing verification:', error);
    return errorResponse(
      'Verification failed',
      'VERIFICATION_FAILED',
      500,
      { message: error instanceof Error ? error.message : String(error) }
    );
  }
}
