import { User } from '@/types/user';
import { processApiError } from '@/utils/api';

/**
 * API client for authentication-related endpoints
 */
export class AuthAPI {
  /**
   * Verify a wallet signature and get a JWT token
   */
  static async verifySignature(
    address: string,
    signature: string,
    message: string
  ): Promise<{
    token: string;
    user: User;
    allowed: boolean;
  }> {
    try {
      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          signature,
          message,
        }),
      });

      if (!response.ok) {
        // Get error data with fallback to empty object
        const errorData = await response.json().catch(() => ({}));

        // Add status to error data for better error handling
        errorData.status = response.status;

        // Process through the global error handler
        processApiError(errorData);

        throw new Error(
          errorData.error || `Signature verification failed: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      // Process all errors through the global handler
      processApiError(error);
      throw error;
    }
  }

  /**
   * Refresh an authentication token
   */
  static async refreshToken(token: string): Promise<{
    token: string;
    user?: User;
  }> {
    try {
      console.log('[AuthAPI] Attempting to refresh token...');

      const response = await fetch('/api/wallet/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Log the response status for debugging
      console.log(`[AuthAPI] Refresh response status: ${response.status}`);

      if (!response.ok) {
        // Get error data with fallback to empty object
        const errorData = await response.json().catch(() => ({}));

        // Add status to error data for better error handling
        errorData.status = response.status;

        console.error('[AuthAPI] Token refresh failed:', errorData);

        // Process through the global error handler - critical for token refresh errors
        processApiError(errorData);

        throw new Error(
          errorData.error || `Token refresh failed: ${response.status}`
        );
      }

      const refreshData = await response.json();
      console.log('[AuthAPI] Refresh successful, new token received');

      // The API currently returns { token, success } but we need { token, user }
      // Either update your API to include user data, or reconstruct it here
      return {
        token: refreshData.token,
        // If API doesn't return user, we'll need to get it another way or
        // update refreshSession in your backend to include user data
        user: refreshData.user || undefined
      };
    } catch (error) {
      console.error('[AuthAPI] Token refresh error:', error);

      // Process all errors through the global handler
      processApiError(error);
      throw error;
    }
  }

  /**
   * Logout and invalidate token
   */
  static async logout(token: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch('/api/wallet/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Get error data but don't throw for logout
        const errorData = await response.json().catch(() => ({}));
        errorData.status = response.status;

        // Still process through handler but don't throw
        processApiError(errorData);

        // For logout, always return success=true even on API error
        // This ensures the client-side state is cleared
        return { success: true };
      }

      return await response.json();
    } catch (error) {
      // Process error but don't rethrow for logout
      processApiError(error);
      console.error('Logout API error:', error);

      // Always return success for logout
      return { success: true };
    }
  }

  /**
   * Verify if token is still valid
   */
  static async verifyToken(token: string): Promise<{
    valid: boolean;
    user?: User;
  }> {
    try {
      const response = await fetch('/api/wallet/verify', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Get error data
        const errorData = await response.json().catch(() => ({}));
        errorData.status = response.status;

        // Process through global handler
        processApiError(errorData);

        return { valid: false };
      }

      return await response.json();
    } catch (error) {
      processApiError(error);
      return { valid: false };
    }
  }
}
