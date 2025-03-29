import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withApiRoute } from '@/middlewares/withApiRoute';
import crypto from 'crypto';
import os from 'os';

/**
 * Get or create the current device
 */
export const GET = withApiRoute(async () => {
  try {
    // Get or create the current device
    let currentDevice = await prisma.device.findFirst({
      where: { isMain: true }
    });

    if (!currentDevice) {
      // Get the server's IP address
      const hostname = os.hostname();
      const networkInterfaces = os.networkInterfaces();
      let ipAddress = '127.0.0.1';

      // Try to find a non-internal IPv4 address
      Object.keys(networkInterfaces).forEach((interfaceName) => {
        const interfaces = networkInterfaces[interfaceName];
        interfaces?.forEach((iface) => {
          if (iface.family === 'IPv4' && !iface.internal) {
            ipAddress = iface.address;
          }
        });
      });

      // Create the current device
      currentDevice = await prisma.device.create({
        data: {
          name: `Main Server (${hostname})`,
          ipAddress,
          port: parseInt(process.env.PORT || '3000'),
          isMain: true,
          isActive: true,
          lastSeen: new Date(),
          apiKey: crypto.randomBytes(32).toString('hex')
        }
      });
    }

    return NextResponse.json(currentDevice);
  } catch (error) {
    console.error('Error getting current device:', error);
    return NextResponse.json(
      { error: 'Failed to get current device' },
      { status: 500 }
    );
  }
});
