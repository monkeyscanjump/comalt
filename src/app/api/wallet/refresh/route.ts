export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, refreshSession } from '@/utils/auth';
import { clearCachedToken } from '@/services/tokenCache';
import { errorResponse, getAuthToken } from '@/utils/api';

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const token = getAuthToken(request);

    if (!token) {
      return NextResponse.json({
        error: 'Missing or invalid token',
        errorCode: 'TOKEN_MISSING'
      }, { status: 401 });
    }

    // Basic format validation - JWT tokens have format: header.payload.signature
    if (!token.includes('.') || token.split('.').length !== 3) {
      return NextResponse.json({
        error: 'Invalid token format',
        errorCode: 'INVALID_TOKEN_FORMAT'
      }, { status: 401 });
    }

    // Refresh the session
    const newToken = await refreshSession(token);

    if (!newToken) {
      return NextResponse.json({
        error: 'Failed to refresh token',
        errorCode: 'REFRESH_FAILED'
      }, { status: 401 });
    }

    // Clear the old token from cache
    clearCachedToken(token);

    // Return the new token
    return NextResponse.json({
      token: newToken,
      success: true
    });
  } catch (error) {
    console.error('Token refresh error:', error);

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
