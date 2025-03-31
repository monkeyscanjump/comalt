import { NextRequest, NextResponse } from 'next/server';
import { getDriveApi } from '@/app/api/drive/utils/drive';

// POST endpoint to create a shareable link
export async function POST(
  req: NextRequest,
  { params }: { params: { cid: string } }
) {
  const { cid } = params;
  const network = req.nextUrl.searchParams.get('network') || 'mainnet';
  console.log(`POST /api/drive/files/${cid}/share - Creating shareable link (network: ${network})`);

  try {
    const driveApi = getDriveApi(network);

    // Use the SDK's publishObject method to make the file publicly accessible
    const publicUrl = await driveApi.publishObject(cid);

    console.log(`Created shareable link for ${cid} on network ${network}: ${publicUrl}`);
    return NextResponse.json({
      success: true,
      publicUrl
    });
  } catch (error) {
    console.error(`Error creating shareable link on network ${network}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create shareable link' },
      { status: 500 }
    );
  }
}
