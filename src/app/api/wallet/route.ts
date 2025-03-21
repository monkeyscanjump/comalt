export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { generateToken } from '@/utils/auth';
import prisma from '@/lib/prisma';
import {
  parseRequestBody,
  checkRateLimit,
  rateLimitResponse,
  errorResponse,
  validateWalletAccess,
  verifyWalletSignature
} from '@/utils/api';

// Define rate limit constants
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimit = checkRateLimit(
    request,
    'wallet-auth',
    RATE_LIMIT_WINDOW,
    MAX_REQUESTS_PER_WINDOW
  );

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.retryAfter ?? 60);
  }

  try {
    // Parse request body
    const body = await parseRequestBody<{
      address: string;
      signature: string;
      message: string;
    }>(request);

    if (!body) {
      return errorResponse('Invalid request body', 'INVALID_REQUEST', 400);
    }

    const { address, signature, message } = body;

    if (!address || !signature || !message) {
      return errorResponse('Missing required fields', 'MISSING_FIELDS', 400);
    }

    // Validate wallet address format
    if (!address.match(/^[a-zA-Z0-9]{48}$/)) {
      return errorResponse('Invalid wallet address format', 'INVALID_ADDRESS', 400);
    }

    // Check if wallet is allowed to authenticate
    const { allowed, isPublicMode } = validateWalletAccess(address);
    if (!allowed) {
      return errorResponse(
        'Your wallet is not authorized to access this system',
        'WALLET_NOT_AUTHORIZED',
        403
      );
    }

    // Verify the signature
    const { isValid, method } = await verifyWalletSignature(
      message,
      signature,
      address
    );

    if (!isValid) {
      return errorResponse(
        'Invalid signature',
        'INVALID_SIGNATURE',
        401
      );
    }

    console.log(`Signature verified with ${method}`);

    // Get or create user
    let user;
    try {
      // Check if user exists
      user = await prisma.user.findFirst({
        where: { address }
      });

      if (!user) {
        console.log('Creating new user');
        user = await prisma.user.create({
          data: {
            address,
            name: `User ${address.substring(0, 6)}...`
          }
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date()
          }
        });
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      return errorResponse('Database error', 'DATABASE_ERROR', 500);
    }

    // Generate token
    let token;
    try {
      token = generateToken({
        sub: user.id,
        address: user.address,
        isAdmin: user.isAdmin || true
      });
      console.log('Token generated');
    } catch (tokenError) {
      console.error('Token generation error:', tokenError);
      return errorResponse('Token generation failed', 'TOKEN_GENERATION_ERROR', 500);
    }

    // Create session record
    try {
      const existingSession = await prisma.session.findFirst({
        where: { userId: user.id }
      });

      if (existingSession) {
        await prisma.session.update({
          where: { id: existingSession.id },
          data: {
            token,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
          }
        });
      } else {
        await prisma.session.create({
          data: {
            token,
            userId: user.id,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
          }
        });
      }
    } catch (sessionError) {
      console.error('Session error:', sessionError);
      // Non-fatal - continue without session record
    }

    // Return success with token and user info
    return NextResponse.json({
      token,
      user,
      allowed
    });
  } catch (error) {
    console.error('Wallet auth error:', error);
    return errorResponse(
      'Authentication failed',
      'AUTHENTICATION_FAILED',
      500,
      { message: error instanceof Error ? error.message : String(error) }
    );
  }
}
