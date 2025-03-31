import { NextRequest, NextResponse } from 'next/server';
import { getDriveApi } from '@/app/api/drive/utils/drive';
import { getContentTypeFromExtension, collectAsyncIterable } from '@/app/api/drive/utils/fileUtils';

// GET endpoint to view/download a file
export async function GET(
  req: NextRequest,
  { params }: { params: { cid: string } }
) {
  const { cid } = params;
  const network = req.nextUrl.searchParams.get('network') || 'mainnet';
  console.log(`GET /api/drive/files/${cid}/view - Viewing/downloading file (network: ${network})`);

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

    // First get file info from the list of files
    console.log(`Fetching file info for CID ${cid} on network ${network}`);
    const filesResult = await driveApi.getMyFiles(0, 100);
    const fileData = filesResult.rows.find(file => file.headCid === cid);

    if (!fileData) {
      console.log(`File with CID ${cid} not found in user files, will attempt direct download`);
    } else {
      console.log(`File info:`, fileData);
    }

    // Download the file using the SDK's download function
    console.log(`Downloading file content for CID ${cid} from network ${network}`);
    try {
      // Try downloading the file first without password
      let fileStream;
      try {
        fileStream = await driveApi.downloadFile(cid);
      } catch (encryptionError: any) {
        // Check if error is due to missing password
        if (encryptionError.message && encryptionError.message.includes('Password is required')) {
          console.log('File is encrypted, retrying with environment encryption key');
          const password = process.env.AUTO_DRIVE_ENCRYPTION_KEY;

          if (!password) {
            console.error('AUTO_DRIVE_ENCRYPTION_KEY environment variable is not set');
            throw new Error('Encrypted file detected but no decryption key available');
          }

          // Retry with password from environment
          fileStream = await driveApi.downloadFile(cid, password);
          console.log('Successfully downloaded encrypted file using environment key');
        } else {
          // If it's not an encryption error, rethrow
          throw encryptionError;
        }
      }

      // Collect all chunks from the async iterable
      const fileBuffer = await collectAsyncIterable(fileStream);

      // Get filename from request if provided, otherwise use the one from metadata
      const requestFilename = req.nextUrl.searchParams.get('filename');
      const filename = requestFilename || fileData?.name || `file-${cid}`;

      // Set the appropriate content type
      const headers = new Headers();

      // Fix the type comparison by checking type exists and using string comparison
      if (fileData?.type && fileData.type === 'file') {
        // Use the type from metadata if available and specific
        headers.set('Content-Type', fileData.type);
      } else {
        // Otherwise try to detect from filename extension
        const detectedType = getContentTypeFromExtension(filename);
        headers.set('Content-Type', detectedType);
      }

      console.log(`Setting Content-Type to ${headers.get('Content-Type')} for file ${filename}`);

      // Set filename for download - use attachment for force download or inline for browser viewing
      const disposition = req.nextUrl.searchParams.get('download') === 'true'
        ? 'attachment'
        : 'inline';

      headers.set('Content-Disposition', `${disposition}; filename="${filename}"`);
      headers.set('Content-Length', fileBuffer.length.toString());

      console.log(`Returning file: ${filename} (${headers.get('Content-Type')}) - ${fileBuffer.length} bytes`);

      // Return the file content
      return new NextResponse(fileBuffer, {
        status: 200,
        headers,
      });
    } catch (downloadError: any) {
      console.error('Error downloading file:', downloadError);
      return NextResponse.json(
        { error: `Failed to retrieve file: ${downloadError.message || 'File not found or not accessible'}` },
        { status: 404 }
      );
    }
  } catch (error: any) {
    console.error('File viewing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve file' },
      { status: 500 }
    );
  }
}
