export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { isAddressAllowed, isPublicMode } from '@/lib/whitelist-server';

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const allowed = isAddressAllowed(address);
    const publicMode = isPublicMode();

    return NextResponse.json({
      isAllowed: allowed,
      isPublicMode: publicMode
    });
  } catch (error) {
    console.error('Error validating address:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
