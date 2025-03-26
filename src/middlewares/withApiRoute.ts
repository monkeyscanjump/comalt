import { NextRequest, NextResponse } from 'next/server';
import {
  checkRateLimit,
  rateLimitResponse,
  errorResponse,
  processApiError
} from '@/utils/api';
import { authenticateRequest } from '@/utils/apiAuth';

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

      // 2. Check authentication if required
      if (options.requireAuth) {
        const auth = await authenticateRequest(request, options.requireAdmin);

        if (!auth.authenticated || auth.error) {
          return auth.error || errorResponse('Authentication required', 'AUTH_REQUIRED', 401);
        }

        // Attach auth info to request for the handler to use
        (request as any).auth = auth;
      }

      // 3. Call the handler
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
