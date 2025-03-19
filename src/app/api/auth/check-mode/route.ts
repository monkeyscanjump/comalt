export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  // Get allowed addresses from server environment
  const allowedWallets = process.env.ALLOWED_WALLETS || '';
  const allowedAddresses = allowedWallets.split(',').map(addr => addr.trim()).filter(Boolean);

  console.log('Server checking public mode');
  console.log('Server allowed addresses count:', allowedAddresses.length);

  // Public mode if no addresses
  const isPublicMode = allowedAddresses.length === 0;

  return NextResponse.json({
    isPublicMode,
    // For dev environment only, send count of addresses for debugging
    addressCount: process.env.NODE_ENV === 'development' ? allowedAddresses.length : undefined
  });
}
