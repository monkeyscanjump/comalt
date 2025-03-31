import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withApiRoute } from '@/middlewares/withApiRoute';

export const dynamic = 'force-dynamic';

/**
 * Handler for proxying GET requests to other devices
 */
export const GET = withApiRoute(async (
  request: NextRequest,
  context: { params?: { path: string[] } }
) => {
  // Ensure params exists, with fallback if it doesn't
  const path = context.params?.path || [];
  return proxyRequest(request, path, 'GET');
});

/**
 * Handler for proxying POST requests to other devices
 */
export const POST = withApiRoute(async (
  request: NextRequest,
  context: { params?: { path: string[] } }
) => {
  const path = context.params?.path || [];
  return proxyRequest(request, path, 'POST');
});

/**
 * Handler for proxying PUT requests to other devices
 */
export const PUT = withApiRoute(async (
  request: NextRequest,
  context: { params?: { path: string[] } }
) => {
  const path = context.params?.path || [];
  return proxyRequest(request, path, 'PUT');
});

/**
 * Handler for proxying DELETE requests to other devices
 */
export const DELETE = withApiRoute(async (
  request: NextRequest,
  context: { params?: { path: string[] } }
) => {
  const path = context.params?.path || [];
  return proxyRequest(request, path, 'DELETE');
});

/**
 * Common function to handle proxying requests to remote devices
 */
async function proxyRequest(
  request: NextRequest,
  path: string[],
  method: string
): Promise<NextResponse> {
  try {
    // Get deviceId from the query parameters
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required' },
        { status: 400 }
      );
    }

    // Get the device
    const device = await prisma.device.findUnique({
      where: { id: deviceId }
    });

    if (!device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    if (!device.isActive) {
      return NextResponse.json(
        { error: 'Device is offline' },
        { status: 503 }
      );
    }

    // Construct the target URL
    const apiPath = path.join('/');
    const targetUrl = `http://${device.ipAddress}:${device.port}/api/${apiPath}`;

    // Forward the request with the same headers and body
    const headers = new Headers();

    // Copy original headers except host
    request.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'host') {
        headers.set(key, value);
      }
    });

    // Add device API key for authentication with remote device
    headers.set('X-Device-ID', device.id);
    headers.set('X-API-Key', device.apiKey);

    // Make the request to the remote device
    const response = await fetch(targetUrl, {
      method,
      headers,
      body: method !== 'GET' ? await request.text() : undefined,
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    // Get the response body
    const responseData = await response.json();

    // Update device last seen time on successful request
    await prisma.device.update({
      where: { id: device.id },
      data: { lastSeen: new Date() }
    });

    // Return the proxied response
    return NextResponse.json(responseData, {
      status: response.status,
      headers: {
        'X-Proxied-From': device.name
      }
    });
  } catch (error) {
    console.error('Proxy error:', error);

    // Get searchParams from the original request URL
    const { searchParams } = new URL(request.url);

    // Check if it's a timeout or connection failure
    if (error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('fetch failed'))) {

      // Update the device status to inactive
      if (searchParams && searchParams.get('deviceId')) {
        await prisma.device.update({
          where: { id: searchParams.get('deviceId')! },
          data: { isActive: false }
        });
      }

      return NextResponse.json(
        { error: 'Device is unreachable', details: error.message },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to proxy request', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
