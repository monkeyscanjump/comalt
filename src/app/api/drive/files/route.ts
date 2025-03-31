import { NextRequest, NextResponse } from 'next/server';
import { getDriveApi } from '@/app/api/drive/utils/drive';

// GET endpoint to list files
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '0');
  const limit = parseInt(searchParams.get('limit') || '20');
  const searchQuery = searchParams.get('query') || '';
  const network = searchParams.get('network') || 'mainnet';

  console.log(`GET /api/drive/files - Listing files (network: ${network})`);

  try {
    console.log(`Query params: page=${page}, limit=${limit}, query=${searchQuery}, network=${network}`);

    const driveApi = getDriveApi(network);

    let files;
    if (searchQuery) {
      // Search files by name or CID
      console.log(`Searching for files with query: ${searchQuery} on network: ${network}`);
      files = await driveApi.searchByNameOrCIDInMyFiles(searchQuery);
      console.log(`Found ${files?.length || 0} files matching query on network: ${network}`);
      return NextResponse.json({ files });
    } else {
      // Get paginated list of files
      console.log(`Getting files for page ${page} with limit ${limit} on network: ${network}`);
      const result = await driveApi.getMyFiles(page, limit);
      console.log(`Retrieved ${result.rows?.length || 0} files of ${result.totalCount || 0} total on network: ${network}`);

      return NextResponse.json({
        files: result.rows,
        totalCount: result.totalCount
      });
    }
  } catch (error) {
    console.error(`Drive API error on network ${network}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch files' },
      { status: 500 }
    );
  }
}

// POST endpoint to upload a file
export async function POST(req: NextRequest) {
  const network = req.nextUrl.searchParams.get('network') || 'mainnet';
  console.log(`POST /api/drive/files - Uploading file (network: ${network})`);

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const compression = formData.get('compression') === 'true';
    const enableEncryption = formData.get('encryption') !== 'false'; // Default to true if not specified

    // Only use encryption key if encryption is enabled
    const password = enableEncryption ? process.env.AUTO_DRIVE_ENCRYPTION_KEY : undefined;

    if (!file) {
      console.error('No file provided in the request');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`Uploading file: ${file.name} (${file.size} bytes), compression: ${compression}, encryption: ${enableEncryption ? 'enabled' : 'disabled'}, network: ${network}`);

    const driveApi = getDriveApi(network);
    const cid = await driveApi.uploadFileFromInput(file, {
      compression,
      password,
    });

    console.log(`File uploaded successfully with CID: ${cid} on network: ${network}`);

    return NextResponse.json({
      success: true,
      cid,
      name: file.name,
      size: file.size,
      type: file.type,
      encrypted: !!password // Return whether encryption was used
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
