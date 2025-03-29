import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Update device status via ping
 * This endpoint doesn't require JWT auth as it uses device-specific API key
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.deviceId || !body.apiKey) {
      return NextResponse.json(
        { error: 'Device ID and API key required' },
        { status: 400 }
      );
    }

    // Validate device credentials
    const device = await prisma.device.findUnique({
      where: { id: body.deviceId }
    });

    if (!device || device.apiKey !== body.apiKey) {
      return NextResponse.json(
        { error: 'Invalid device credentials' },
        { status: 401 }
      );
    }

    // Update device status
    await prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeen: new Date(),
        isActive: true
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing ping:', error);
    return NextResponse.json(
      { error: 'Failed to process ping' },
      { status: 500 }
    );
  }
}
