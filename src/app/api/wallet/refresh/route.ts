export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, refreshSession } from '@/utils/auth';
import { clearCachedToken } from '@/services/tokenCache';

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('Authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json({
        error: 'Missing or invalid token',
        errorCode: 'TOKEN_MISSING'
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

    // Clear the old token from cache using the service
    clearCachedToken(token);

    // Return the new token
    return NextResponse.json({
      success: true,
      token: newToken
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
