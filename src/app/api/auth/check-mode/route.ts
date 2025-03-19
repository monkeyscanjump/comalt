import { NextResponse } from 'next/server';
import { isPublicMode, getAllowedAddresses } from '@/lib/whitelist-server';

export const dynamic = 'force-dynamic'; // Ensures the response isn't cached

export async function GET() {
  const publicMode = isPublicMode();

  return NextResponse.json({
    isPublicMode: publicMode,
    // For dev environment only, send count of addresses for debugging
    addressCount: process.env.NODE_ENV === 'development'
      ? getAllowedAddresses().length
      : undefined
  });
}
