import { TokenPayload } from '@/types/auth';
import { generateToken, refreshSession } from '@/utils/auth';
import prisma from '@/lib/prisma';
import { setTokenExpired, verifyWalletSignature as apiVerifyWalletSignature } from '@/utils/api';
import * as serverWhitelist from '@/lib/whitelist-server';

/**
 * Generate a unique user ID from a wallet address
 */
function generateUniqueUserId(address: string): string {
  // Create a hash from the address to ensure uniqueness
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    const char = address.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Use address prefix plus hash portion for a readable but unique ID
  const prefix = address.substring(0, 6);
  const hashPart = Math.abs(hash).toString(16).substring(0, 8);

  return `${prefix}-${hashPart}`;
}

export class AuthService {
  /**
   * Authenticate a user with wallet signature
   */
  static async authenticateWithSignature(address: string, signature: string, message: string) {
    // Validate signature using existing utility
    const result = await apiVerifyWalletSignature(message, signature, address);
    if (!result.isValid) {
      throw new Error('Invalid signature');
    }

    // Get or create user
    const user = await this.getOrCreateUser(address);

    // Generate token
    const token = this.generateUserToken(user);

    // Create session
    await this.createSession(user.id, token);

    return { user, token };
  }

  /**
   * Get or create a user by address
   */
  static async getOrCreateUser(address: string) {
    // Check if user exists
    let user = await prisma.user.findUnique({ where: { address } });

    // Check if this address should be admin (first in ALLOWED_WALLETS)
    const isAdmin = serverWhitelist.isAddressAdmin(address);

    // Create if not exists
    if (!user) {
      user = await prisma.user.create({
        data: {
          address,
          id: generateUniqueUserId(address),
          isAdmin // Set admin flag when creating
        }
      });
    } else if (user.isAdmin !== isAdmin) {
      // Update admin status if it changed
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isAdmin }
      });
    }

    return user;
  }

  /**
   * Generate a token for a user
   */
  static generateUserToken(user: { id: string, address: string, isAdmin?: boolean }) {
    const payload: TokenPayload = {
      sub: user.id,
      address: user.address,
      isAdmin: !!user.isAdmin
    };

    return generateToken(payload);
  }

  /**
   * Create a new session
   */
  static async createSession(userId: string, token: string) {
    // Calculate expiration
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    const durationMs = this.parseDuration(expiresIn);
    const expiresAt = new Date(Date.now() + durationMs);

    // Create session
    return await prisma.session.create({
      data: {
        userId,
        token,
        expiresAt
      }
    });
  }

  /**
   * Refresh a token
   */
  static async refreshToken(currentToken: string) {
    const newToken = await refreshSession(currentToken);

    if (newToken) {
      // Mark token as not expired
      setTokenExpired(false);
      return newToken;
    }

    return null;
  }

  /**
   * Logout a user by invalidating their session
   */
  static async logout(token: string): Promise<boolean> {
    try {
      // Find and delete the session
      const session = await prisma.session.findFirst({
        where: { token }
      });

      if (session) {
        await prisma.session.delete({
          where: { id: session.id }
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Session invalidation error:', error);
      return false;
    }
  }

  /**
   * Parse duration string to milliseconds
   */
  static parseDuration(duration: string): number {
    let durationMs = 86400000; // Default 24 hours

    try {
      if (typeof duration === 'string') {
        if (duration.endsWith('h')) {
          const hours = parseInt(duration.slice(0, -1), 10);
          durationMs = hours * 3600000;
        } else if (duration.endsWith('m')) {
          const minutes = parseInt(duration.slice(0, -1), 10);
          durationMs = minutes * 60000;
        } else if (duration.endsWith('s')) {
          const seconds = parseInt(duration.slice(0, -1), 10);
          durationMs = seconds * 1000;
        } else if (duration.endsWith('d')) {
          const days = parseInt(duration.slice(0, -1), 10);
          durationMs = days * 86400000;
        } else {
          durationMs = parseInt(duration, 10);
        }
      }
    } catch (error) {
      console.error('Error parsing duration:', error);
    }

    return durationMs;
  }
}
