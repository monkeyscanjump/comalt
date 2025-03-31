import { NextRequest, NextResponse } from 'next/server';
import { getDriveApi } from '@/app/api/drive/utils/drive';

// Define types to match your API
interface FileInfo {
  headCid: string;
  name?: string;
  size: number;
  type: string;
  mimeType?: string;
}

interface FolderInfo {
  headCid: string;
  name?: string;
  size: number;
  type: string;
  children?: FileInfo[];
}

interface FileResult {
  rows: FileInfo[];
  totalCount: number;
}

// GET endpoint to retrieve file metadata
export async function GET(
  req: NextRequest,
  { params }: { params: { cid: string } }
) {
  const { cid } = params;
  const network = req.nextUrl.searchParams.get('network') || 'mainnet';
  console.log(`GET /api/drive/files/${cid}/info - Getting file info (network: ${network})`);

  // Validate CID parameter
  if (!cid || cid === 'undefined') {
    console.error('Invalid or missing CID parameter');
    return NextResponse.json(
      { error: 'Invalid or missing file identifier' },
      { status: 400 }
    );
  }

  try {
    const driveApi = getDriveApi(network);

    // Get file from the list of user's files - using existing method from your code
    console.log(`Getting file info for CID ${cid} from user's files on network ${network}`);
    const filesResult = await driveApi.getMyFiles(0, 1000) as FileResult; // Large limit to find the file

    // Look for the file with matching CID - only check headCid which definitely exists
    const file = filesResult.rows.find(f => f.headCid === cid);

    if (!file) {
      console.error(`No file found with CID ${cid} in user's files`);
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    console.log(`Found file with CID ${cid} in user's files:`, file);

    // Check if it's a folder based on the type property
    let isFolder = file.type === 'folder';
    let folderContents: FileInfo[] = [];

    // Check if this is a folder by looking at the name pattern of all files
    if (!isFolder && file.name) {
      // Since we already have all files from getMyFiles, let's check if any files
      // have this file's name as a prefix (indicating it's a folder)
      const prefix = `${file.name}/`;
      const matchingFiles = filesResult.rows.filter(f =>
        f.name && f.name.startsWith(prefix)
      );

      if (matchingFiles.length > 0) {
        console.log(`File ${file.name} appears to be a folder with ${matchingFiles.length} files`);
        isFolder = true;
        folderContents = matchingFiles.map(f => ({
          ...f,
          // Add cleanName only if name exists
          ...(f.name ? { cleanName: f.name.substring(prefix.length) } : {})
        }));
      }
    }

    // Enhance the file info with additional properties
    const enhancedFileInfo = {
      ...file,
      isFolder,
      fileCount: isFolder ? folderContents.length : 0,
      contents: isFolder ? folderContents : [],
      extension: file.name ? file.name.split('.').pop()?.toLowerCase() || '' : '',
      network,
      retrievedAt: new Date().toISOString()
    };

    console.log(`Returning enhanced file info for ${cid}`);
    return NextResponse.json(enhancedFileInfo);
  } catch (error) {
    console.error(`File info error for CID ${cid}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve file info' },
      { status: 500 }
    );
  }
}
