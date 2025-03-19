export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

// Get allowed addresses from server environment
const getAllowedAddresses = (): string[] => {
  const allowedWallets = process.env.ALLOWED_WALLETS || '';
  return allowedWallets.split(',').map(addr => addr.trim()).filter(Boolean);
};

// Check if in public mode (no whitelist)
const isPublicMode = (): boolean => {
  return getAllowedAddresses().length === 0;
};

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const allowedAddresses = getAllowedAddresses();
    console.log('Server checking address:', address);
    console.log('Server allowed addresses:', allowedAddresses);

    const publicMode = allowedAddresses.length === 0;

    // Either we're in public mode or the address is explicitly allowed
    const isAllowed = publicMode || allowedAddresses.includes(address);

    console.log('Server check result:', { isAllowed, publicMode });

    return NextResponse.json({
      isAllowed,
      isPublicMode: publicMode
    });
  } catch (error) {
    console.error('Error validating address:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
