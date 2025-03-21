import jwt from 'jsonwebtoken';
import { isAddressAllowed } from '@/config/whitelist';
import prisma from '@/lib/prisma';

// Define type for token payload
export interface TokenPayload {
  sub: string;          // User ID
  address: string;      // Wallet address
  isAdmin?: boolean;    // Admin status flag
  iat?: number;         // Issued at timestamp
  exp?: number;         // Expiration timestamp
}

// Get JWT secret from environment
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

// JWT Secret - load once at startup
const JWT_SECRET = getJwtSecret();

// Extract token from authorization header
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;

  // Look for "Bearer <token>" format
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }

  // If not in bearer format, return the whole header as token
  return authHeader;
}

/**
 * Generate JWT token for a user
 * @param payload Data to include in the token
 * @returns JWT token string
 */
export function generateToken(payload: TokenPayload): string {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not defined');

  // Create a JWT token with standard fields
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h', // Token expires in 24 hours
  });
}

/**
 * Verify JWT token
 * @param token JWT token to verify
 * @returns Decoded token payload or null if invalid
 */
export function verifyToken(token: string): TokenPayload | null {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not defined');

  try {
    // Add basic format check before verification
    if (!token || !token.includes('.') || token.split('.').length !== 3) {
      console.warn('Invalid token format detected');
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

    // Validate payload has required fields
    if (!decoded || !decoded.sub || !decoded.address) {
      console.warn('Token has invalid payload structure');
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Verify token and check if the address is allowed
 * @param token JWT token to verify and check
 * @returns Object with validation result and access information
 */
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
 * Refresh user session with new token
 * @param currentToken Current token to refresh
 * @returns New token or null if refresh fails
 */
export async function refreshSession(currentToken: string): Promise<string | null> {
  try {
    // Verify the current token
    const payload = verifyToken(currentToken);
    if (!payload) return null;

    // Check if user is still allowed
    const allowed = isAddressAllowed(payload.address);
    if (!allowed) return null;

    // Lookup user to ensure they still exist
    const user = await prisma.user.findUnique({
      where: { id: payload.sub }
    });

    if (!user) return null;

    // Generate a new token with the same user info
    const newToken = generateToken({
      sub: user.id,
      address: user.address,
      isAdmin: user.isAdmin || true
    });

    // Update the session in database
    try {
      const session = await prisma.session.findFirst({
        where: { token: currentToken }
      });

      if (session) {
        await prisma.session.update({
          where: { id: session.id },
          data: {
            token: newToken,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
          }
        });
      } else {
        // Create new session if old one wasn't found
        await prisma.session.create({
          data: {
            token: newToken,
            userId: user.id,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        });
      }
    } catch (dbError) {
      console.error('Database error updating session:', dbError);
      // Continue even if database update fails
    }

    return newToken;
  } catch (error) {
    console.error('Session refresh error:', error);
    return null;
  }
}

/**
 * Invalidate a session by token
 * @param token Token to invalidate
 * @returns Whether invalidation was successful
 */
export async function invalidateSession(token: string): Promise<boolean> {
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
