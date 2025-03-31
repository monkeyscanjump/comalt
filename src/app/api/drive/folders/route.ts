import { NextRequest, NextResponse } from 'next/server';
import { getDriveApi } from '@/app/api/drive/utils/drive';

// POST endpoint to upload a folder (multiple files)
export async function POST(req: NextRequest) {
  const network = req.nextUrl.searchParams.get('network') || 'mainnet';
  console.log(`POST /api/drive/folders - Uploading folder (network: ${network})`);

  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const compression = formData.get('compression') === 'true';
    const enableEncryption = formData.get('encryption') !== 'false'; // Default to true if not specified

    // Only use encryption key if encryption is enabled
    const password = enableEncryption ? process.env.AUTO_DRIVE_ENCRYPTION_KEY : undefined;

    if (!files.length) {
      console.error('No files provided in the request');
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    console.log(`Uploading folder with ${files.length} files, compression: ${compression}, encryption: ${enableEncryption ? 'enabled' : 'disabled'}, network: ${network}`);

    const driveApi = getDriveApi(network);

    // Since we can't create a real FileList, we'll upload each file separately
    // and use a naming convention for organization
    const fileResults = [];
    const folderName = formData.get('folderName') as string || `Folder-${Date.now()}`;

    for (const file of files) {
      // Create a new file with a prefixed name using Blob
      const renamedFile = new File(
        [await file.arrayBuffer()],
        `${folderName}/${file.name}`,
        { type: file.type }
      );

      console.log(`Uploading file: ${renamedFile.name} (${renamedFile.size} bytes) to network: ${network}`);

      // Upload with password only if encryption is enabled
      const cid = await driveApi.uploadFileFromInput(renamedFile, {
        compression,
        password,
      });

      fileResults.push({
        name: file.name,
        folderName: folderName,
        fullPath: renamedFile.name,
        cid,
        size: file.size,
        encrypted: !!password
      });
    }

    console.log(`Folder upload completed with ${fileResults.length} files on network: ${network}`);

    return NextResponse.json({
      success: true,
      folderName,
      files: fileResults,
      network,
      encrypted: !!password
    });
  } catch (error) {
    console.error(`Folder upload error on network ${network}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload folder' },
      { status: 500 }
    );
  }
}

// GET endpoint to list folders
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const network = searchParams.get('network') || 'mainnet';
  console.log(`GET /api/drive/folders - Listing folders (network: ${network})`);

  try {
    const driveApi = getDriveApi(network);

    // Get files from the API
    const result = await driveApi.getMyFiles(0, 1000); // Get a large number of files to process

    // Group files by folder based on name prefix pattern
    const folderMap = new Map();
    const now = new Date().toISOString();

    for (const file of result.rows) {
      // Check if the file name includes a folder structure (contains /)
      if (file.name && file.name.includes('/')) {
        const parts = file.name.split('/');
        const folderName = parts[0]; // First part is the folder name
        const fileName = parts.slice(1).join('/'); // Rest is the file name

        if (!folderMap.has(folderName)) {
          folderMap.set(folderName, {
            name: folderName,
            fileCount: 0,
            totalSize: 0,
            files: [],
            // Use current time for all folders
            createdAt: now,
          });
        }

        const folder = folderMap.get(folderName);
        folder.fileCount++;
        folder.totalSize += file.size || 0;

        // Add file to the folder with a clean name
        folder.files.push({
          ...file,
          cleanName: fileName // Store the file name without folder prefix
        });
      }
    }

    const folders = Array.from(folderMap.values());
    console.log(`Found ${folders.length} folders on network: ${network}`);

    return NextResponse.json({
      folders,
      network,
    });
  } catch (error) {
    console.error(`Folder listing error on network ${network}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list folders' },
      { status: 500 }
    );
  }
}
