export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withApiRoute } from '@/middlewares/withApiRoute';
import { validateRequestBody, validateRequired, validateFormat } from '@/utils/validation';
import { validateWalletAccess } from '@/utils/api';
import { AuthService } from '@/services/authService';
import prisma from '@/lib/prisma';

/**
 * Handle wallet authentication request
 */
const handleWalletAuth = async (request: NextRequest) => {
  // Validate request body
  const body = await validateRequestBody(request, (data) => {
    // Check required fields
    ['address', 'signature', 'message'].forEach(field =>
      validateRequired(data[field], field));

    // Validate wallet address format
    validateFormat(
      data.address,
      /^[a-zA-Z0-9]{48}$/,
      'wallet address'
    );

    return data as {
      address: string;
      signature: string;
      message: string;
    };
  });

  const { address, signature, message } = body;

  // Check if wallet is allowed to authenticate
  const { allowed, isPublicMode } = validateWalletAccess(address);
  if (!allowed) {
    const error = new Error('Your wallet is not authorized to access this system');
    (error as any).code = 'WALLET_NOT_AUTHORIZED';
    (error as any).status = 403;
    throw error;
  }

  // Authenticate with signature using AuthService
  let user;
  let token;

  try {
    // Use AuthService for authentication
    const authResult = await AuthService.authenticateWithSignature(
      address,
      signature,
      message
    );

    user = authResult.user;
    token = authResult.token;

    // Update last login time
    // This is not in AuthService so we handle it here
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date()
      }
    });

    console.log(`User authenticated: ${user.id}, address: ${address}`);
  } catch (authError) {
    console.error('Authentication error:', authError);

    // Rethrow with proper error format
    const error = new Error(authError instanceof Error ? authError.message : 'Authentication failed');
    (error as any).code = 'AUTHENTICATION_FAILED';
    (error as any).status = 401;
    throw error;
  }

  // Return success with token and user info
  return NextResponse.json({
    token,
    user: {
      id: user.id,
      address: user.address,
      name: user.name,
      isAdmin: !!user.isAdmin
    },
    allowed
  });
};

// Apply rate limiting middleware
export const POST = withApiRoute(handleWalletAuth, {
  rateLimit: {
    key: 'wallet-auth',
    window: 60 * 1000, // 1 minute
    max: 10
  }
});
