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
    const body = await parseRequestBody<{ address: string; signature: string; message: string }>(request);

    if (!body || !body.address || !body.signature || !body.message) {
      return errorResponse(
        'Missing required fields',
        'INVALID_REQUEST',
        400,
        { required: ['address', 'signature', 'message'] }
      );
    }

    const { address, signature, message } = body;

    // Check whitelist
    const { allowed } = validateWalletAccess(address);
    console.log('Address allowed:', allowed);

    if (!allowed) {
      console.log('Rejecting due to not whitelisted');
      return errorResponse(
        'Your wallet address is not authorized to use this application',
        'WALLET_NOT_ALLOWED',
        403,
        { allowed: false }
      );
    }

    // Verify signature
    const { isValid, method } = await verifyWalletSignature(message, signature, address);

    if (!isValid) {
      console.log('Signature invalid after trying all methods');
      return errorResponse('Invalid signature', 'SIGNATURE_INVALID', 401);
    }

    console.log(`Signature verified successfully using ${method}`);

    // User lookup or creation
    let user;
    try {
      user = await prisma.user.findUnique({ where: { address } });
      console.log('User found:', !!user);

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
        isAdmin: user.isAdmin || false
      });
      console.log('Token generated');
    } catch (tokenError) {
      console.error('Token generation error:', tokenError);
      return errorResponse('Token generation failed', 'TOKEN_GENERATION_ERROR', 500);
    }

    // Create session
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await prisma.session.create({
        data: {
          token,
          userId: user.id,
          expiresAt,
        },
      });
      console.log('Session created');
    } catch (sessionError) {
      console.error('Session creation error:', sessionError);
      return errorResponse('Session creation failed', 'SESSION_CREATION_ERROR', 500);
    }

    console.log('Authentication successful');
    return NextResponse.json({
      token,
      user,
      allowed
    });

  } catch (error) {
    console.error('Unhandled error:', error);
    return errorResponse(
      'Authentication failed',
      'AUTHENTICATION_FAILED',
      500,
      { message: error instanceof Error ? error.message : String(error) }
    );
  }
}
