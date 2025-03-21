import { User } from '@/types/user';
import { config } from '@/config';

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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Signature verification failed: ${response.status}`
      );
    }

    return await response.json();
  }

  /**
   * Verify if a token is valid
   */
  static async verifyToken(token: string): Promise<{
    valid: boolean;
    address?: string;
    userId?: string;
    allowed?: boolean;
    isAdmin?: boolean;
  }> {
    const response = await fetch('/api/wallet/verify', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // If status is 401, token is invalid but it's not an error
      if (response.status === 401) {
        return { valid: false };
      }

      // Other errors
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Token verification failed: ${response.status}`
      );
    }

    return await response.json();
  }

  /**
   * Refresh an authentication token
   */
  static async refreshToken(token: string): Promise<{
    token: string;
    user?: User;
    allowed?: boolean;
  }> {
    const response = await fetch('/api/wallet/refresh', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Token refresh failed: ${response.status}`
      );
    }

    return await response.json();
  }

  /**
   * Logout and invalidate token
   */
  static async logout(token: string): Promise<boolean> {
    try {
      const response = await fetch('/api/wallet/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.warn('Logout response was not OK:', response.status);
        // Not throwing error here - treat logout as "best effort"
        return false;
      }

      const data = await response.json().catch(() => ({}));
      return data.success === true;
    } catch (error) {
      console.error('Logout error:', error);
      // Always return successful even on error - client should still clear local state
      return true;
    }
  }
}
