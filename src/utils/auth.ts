import jwt from 'jsonwebtoken';
import type { TokenPayload } from '@/contexts/auth/AuthTypes';
import { isAddressAllowed } from '@/config/whitelist';
import prisma from '@/lib/prisma';

// Get JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '24h'; // 24 hours

if (!JWT_SECRET) {
  console.error('WARNING: JWT_SECRET environment variable is not set!');
}

// Generate JWT token
export function generateToken(payload: TokenPayload): string {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not defined');

  return jwt.sign(
    payload,
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

// Verify JWT token
export function verifyToken(token: string): TokenPayload | null {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not defined');

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// Verify token and check if the address is allowed
export function verifyAndCheckAccess(token: string): {
  valid: boolean;
  allowed: boolean;
  address: string | null;
  payload: TokenPayload | null;
} {
  const payload = verifyToken(token);

  if (!payload) {
    return { valid: false, allowed: false, address: null, payload: null };
  }

  const allowed = isAddressAllowed(payload.address);

  return {
    valid: true,
    allowed,
    address: payload.address,
    payload
  };
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7);
}

/**
 * Invalidate a session by token
 */
export async function invalidateSession(token: string): Promise<boolean> {
  if (!token) return false;

  try {
    await prisma.session.delete({
      where: { token }
    }).catch(() => {
      console.warn('Session not found when attempting to invalidate');
    });

    return true;
  } catch (error) {
    console.error('Failed to invalidate session:', error);
    return false;
  }
}

/**
 * Refresh a session token
 */
export async function refreshSession(token: string): Promise<string | null> {
  try {
    // Validate current token
    const payload = verifyToken(token);
    if (!payload) return null;

    // Check if still allowed
    const allowed = isAddressAllowed(payload.address);
    if (!allowed) return null;

    // Generate new token with refreshed expiry
    const newToken = generateToken({
      sub: payload.sub,
      address: payload.address,
      isAdmin: payload.isAdmin
    });

    // Update session in database
    await prisma.session.update({
      where: { token },
      data: {
        token: newToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      }
    });

    return newToken;
  } catch (error) {
    console.error('Error refreshing session:', error);
    return null;
  }
}
