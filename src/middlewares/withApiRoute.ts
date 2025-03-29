import { NextRequest, NextResponse } from 'next/server';
import {
  checkRateLimit,
  rateLimitResponse,
  errorResponse,
  processApiError
} from '@/utils/api';
import { authenticateRequest } from '@/utils/apiAuth';
import prisma from '@/lib/prisma';

type ApiHandler = (
  request: NextRequest,
  context: { params?: any }
) => Promise<NextResponse>;

interface ApiRouteOptions {
  requireAuth?: boolean;
  requireAdmin?: boolean;
  rateLimit?: {
    key: string;
    window: number;
    max: number;
  };
  allowDeviceAuth?: boolean; // New option to allow device-to-device auth
}

/**
 * Higher-order function to standardize API route handling
 */
export function withApiRoute(handler: ApiHandler, options: ApiRouteOptions = {}) {
  return async (request: NextRequest, context: { params?: any }) => {
    try {
      // 1. Apply rate limiting if configured
      if (options.rateLimit) {
        const { key, window, max } = options.rateLimit;
        const rateLimit = checkRateLimit(request, key, window, max);

        if (!rateLimit.allowed) {
          return rateLimitResponse(rateLimit.retryAfter ?? 60);
        }
      }

      // 2. Check for device-to-device authentication first (if enabled)
      if (options.allowDeviceAuth !== false) { // Default to allowing device auth
        const deviceId = request.headers.get('X-Device-ID');
        const apiKey = request.headers.get('X-API-Key');

        if (deviceId && apiKey) {
          try {
            const device = await prisma.device.findUnique({
              where: { id: deviceId }
            });

            if (device && device.apiKey === apiKey) {
              // Device is authenticated
              (request as any).auth = {
                authenticated: true,
                isAdmin: true, // Devices get admin privileges for API calls
                deviceAuthenticated: true,
                deviceId: device.id
              };

              // Update device last seen
              await prisma.device.update({
                where: { id: device.id },
                data: { lastSeen: new Date() }
              });

              // Proceed to handler
              return await handler(request, context);
            }
          } catch (error) {
            console.error('Error checking device authentication:', error);
            // Fall through to standard auth
          }
        }
      }

      // 3. Check user authentication if required
      if (options.requireAuth) {
        const auth = await authenticateRequest(request, options.requireAdmin);

        if (!auth.authenticated || auth.error) {
          return auth.error || errorResponse('Authentication required', 'AUTH_REQUIRED', 401);
        }

        // Attach auth info to request for the handler to use
        (request as any).auth = auth;
      }

      // 4. Call the handler
      return await handler(request, context);
    } catch (error) {
      console.error(`[API Error] ${request.method} ${request.url}:`, error);

      // Process API error through global handler
      processApiError(error);

      // Return error response
      if (error instanceof Error) {
        return errorResponse(
          error.message,
          error.name === 'ApiError' ? (error as any).code || 'API_ERROR' : 'INTERNAL_ERROR',
          (error as any).status || 500,
          (error as any).details
        );
      }

      return errorResponse(
        'Internal server error',
        'INTERNAL_ERROR',
        500
      );
    }
  };
}
