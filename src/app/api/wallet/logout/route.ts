export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { invalidateSession } from '@/utils/auth';
import { clearCachedToken } from '@/services/tokenCache';
import { errorResponse, getAuthToken } from '@/utils/api';

export async function POST(request: NextRequest) {
  try {
    const token = getAuthToken(request);

    if (!token) {
      return errorResponse('No token provided', 'TOKEN_MISSING', 401);
    }

    // Use the invalidateSession function
    const success = await invalidateSession(token);

    // Clear token from cache
    clearCachedToken(token);

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Logout successful'
      });
    } else {
      return errorResponse('Failed to invalidate session', 'INVALIDATION_FAILED', 500);
    }
  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse(
      'Internal server error',
      'SERVER_ERROR',
      500,
      { message: error instanceof Error ? error.message : String(error) }
    );
  }
}
