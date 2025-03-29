import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withApiRoute } from '@/middlewares/withApiRoute';
import crypto from 'crypto';

/**
 * Get all devices
 */
export const GET = withApiRoute(async () => {
  const devices = await prisma.device.findMany({
    orderBy: { updatedAt: 'desc' }
  });

  return NextResponse.json(devices);
});

/**
 * Add a new device
 */
export const POST = withApiRoute(async (request: NextRequest) => {
  const body = await request.json();

  // Validate required fields
  if (!body.name || !body.ipAddress) {
    return NextResponse.json(
      { error: 'Name and IP address are required' },
      { status: 400 }
    );
  }

  // Create device with generated API key
  const apiKey = crypto.randomBytes(32).toString('hex');

  try {
    const device = await prisma.device.create({
      data: {
        name: body.name,
        ipAddress: body.ipAddress,
        port: body.port || 3000,
        apiKey,
        isMain: false // Only the current device is main
      }
    });

    return NextResponse.json(device);
  } catch (error) {
    console.error('Error creating device:', error);
    return NextResponse.json(
      { error: 'Failed to create device' },
      { status: 500 }
    );
  }
});
