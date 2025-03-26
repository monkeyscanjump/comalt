export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { clearCachedToken } from '@/services/tokenCache';
import { getAuthToken } from '@/utils/api';
import { withApiRoute } from '@/middlewares/withApiRoute';
import { AuthService } from '@/services/authService';

/**
 * Handle user logout
 */
const handleLogout = async (request: NextRequest) => {
  // Get token from Authorization header
  const token = getAuthToken(request);

  if (!token) {
    const error = new Error('No token provided');
    (error as any).code = 'TOKEN_MISSING';
    (error as any).status = 401;
    throw error;
  }

  // Use the AuthService for session invalidation
  const success = await AuthService.logout(token);

  // Clear token from cache
  clearCachedToken(token);

  if (!success) {
    const error = new Error('Failed to invalidate session');
    (error as any).code = 'INVALIDATION_FAILED';
    (error as any).status = 500;
    throw error;
  }

  // Return success response
  return NextResponse.json({
    success: true,
    message: 'Logout successful'
  });
};

// Export the POST handler with the withApiRoute wrapper
export const POST = withApiRoute(handleLogout);
