import jwt from 'jsonwebtoken';
import { isAddressAllowed } from '@/config/whitelist';
import prisma from '@/lib/prisma';
import { TokenPayload } from '@/types/auth';
import ms from 'ms';

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

  // Use expiration from env or default to 24h
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

  // Create a JWT token with standard fields
  // Fixed: properly type the secret and options separately
  return jwt.sign(
    payload,
    JWT_SECRET,
    { expiresIn } as jwt.SignOptions
  );
}

/**
 * Verify JWT token
 * @param token JWT token to verify
 * @param skipExpirationCheck Whether to skip expiration validation
 * @returns Decoded token payload or null if invalid
 */
export function verifyToken(token: string, skipExpirationCheck = false): TokenPayload | null {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not defined');

  // Add basic format check before verification
  if (!token || !token.includes('.') || token.split('.').length !== 3) {
    console.warn('Invalid token format detected');
    return null;
  }

  // Verify options
  const options: jwt.VerifyOptions = {};

  // Skip expiration check if requested
  if (skipExpirationCheck) {
    options.ignoreExpiration = true;
  }

  // Verify the token
  const decoded = jwt.verify(token, JWT_SECRET, options) as TokenPayload;

  // Validate payload has required fields
  if (!decoded || !decoded.sub || !decoded.address) {
    console.warn('Token has invalid payload structure');
    return null;
  }

  return decoded;
}

/**
 * Safe version of verifyToken that doesn't throw errors
 */
export function safeVerifyToken(token: string, skipExpirationCheck = false): TokenPayload | null {
  try {
    return verifyToken(token, skipExpirationCheck);
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
  try {
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
  } catch (error) {
    console.error('Access check error:', error);
    return { valid: false, allowed: false, address: null, payload: null };
  }
}

/**
 * Extract data from an expired token without verification
 */
function extractExpiredTokenData(token: string): { address?: string; userId?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return {
      address: payload.address,
      userId: payload.sub
    };
  } catch (error) {
    console.error('Failed to extract data from expired token:', error);
    return null;
  }
}

/**
 * Refresh user session with new token
 * @param currentToken Current token to refresh
 * @param addressOverride Optional address override if token data can't be extracted
 * @returns New token or null if refresh fails
 */
export async function refreshSession(
  currentToken: string,
  addressOverride?: string
): Promise<string | null> {
  try {
    let userId: string | undefined;
    let address: string | undefined = addressOverride;
    let isAdmin = false;

    // Try to verify the current token, but allow expired tokens
    try {
      const payload = verifyToken(currentToken, true); // Skip expiration check
      if (payload) {
        userId = payload.sub;
        address = payload.address;
        isAdmin = !!payload.isAdmin;
      }
    } catch (tokenError) {
      console.log('Token verification failed, extracting data without verification:', tokenError);

      // If token is expired, try to extract the data without verification
      const tokenData = extractExpiredTokenData(currentToken);
      if (tokenData) {
        address = tokenData.address || addressOverride;
        userId = tokenData.userId;
      }
    }

    // If we couldn't extract an address, use the override or fail
    if (!address && !addressOverride) {
      console.error('No address could be extracted from token or provided as override');
      return null;
    }

    // Final address to use
    const finalAddress = address || addressOverride!;

    // Check if address is still allowed
    const allowed = await isAddressAllowed(finalAddress);
    if (!allowed) {
      console.warn(`Address ${finalAddress} is no longer allowed`);
      return null;
    }

    // If we don't have a user ID yet, try to get it from the database
    if (!userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { address: finalAddress }
        });

        if (user) {
          userId = user.id;
          isAdmin = !!user.isAdmin;
        } else {
          // If no user found, use address as the ID
          userId = finalAddress;
        }
      } catch (dbError) {
        console.error('Database error during refresh:', dbError);
        // If DB lookup fails, use address as ID
        userId = finalAddress;
      }
    }

    // Generate a new token with the same user info
    const newToken = generateToken({
      sub: userId,
      address: finalAddress,
      isAdmin
    });

    // Update the session in database
    try {
      const session = await prisma.session.findFirst({
        where: { token: currentToken }
      });

      // Get expiration time from env or default
      const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

      // FIX: Handle duration calculation differently
      let durationMs = 86400000; // Default 24 hours in milliseconds

      try {
        if (typeof expiresIn === 'string') {
          // Parse with a more reliable approach
          if (expiresIn.endsWith('h')) {
            const hours = parseInt(expiresIn.slice(0, -1), 10);
            durationMs = hours * 3600000; // Convert hours to ms
          } else if (expiresIn.endsWith('m')) {
            const minutes = parseInt(expiresIn.slice(0, -1), 10);
            durationMs = minutes * 60000; // Convert minutes to ms
          } else if (expiresIn.endsWith('s')) {
            const seconds = parseInt(expiresIn.slice(0, -1), 10);
            durationMs = seconds * 1000; // Convert seconds to ms
          } else if (expiresIn.endsWith('d')) {
            const days = parseInt(expiresIn.slice(0, -1), 10);
            durationMs = days * 86400000; // Convert days to ms
          } else {
            durationMs = parseInt(expiresIn, 10);
          }
        }
      } catch (parseError) {
        console.error('Error parsing duration:', parseError);
        // Use default if parsing fails
      }

      const expiresAt = new Date(Date.now() + durationMs);

      if (session) {
        await prisma.session.update({
          where: { id: session.id },
          data: {
            token: newToken,
            expiresAt
          }
        });
      } else {
        // Create new session if old one wasn't found
        await prisma.session.create({
          data: {
            token: newToken,
            userId,
            expiresAt
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
