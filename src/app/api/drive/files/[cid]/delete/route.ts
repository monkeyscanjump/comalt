import { NextRequest, NextResponse } from 'next/server';
import { getDriveApi } from '@/app/api/drive/utils/drive';

// Define an interface for API errors to help with typing
interface ApiError {
  response?: {
    status?: number;
    data?: {
      error?: string;
    };
  };
  message?: string;
}

// DELETE endpoint to delete a file
export async function DELETE(
  req: NextRequest,
  { params }: { params: { cid: string } }
) {
  const { cid } = params;
  const network = req.nextUrl.searchParams.get('network') || 'mainnet';
  console.log(`DELETE /api/drive/files/${cid} - Deleting file (network: ${network})`);

  try {
    const driveApi = getDriveApi(network);

    // Use the correct endpoint according to the library documentation
    // The API requires a POST to /objects/{cid}/delete
    await driveApi.sendRequest(`/objects/${cid}/delete`, {
      method: 'POST',
    });

    console.log(`File ${cid} deleted successfully on network: ${network}`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    // More detailed error logging
    console.error(`File deletion error on network ${network}:`, error);

    // Properly handle the unknown error type
    let statusCode = 500;
    let errorMessage = 'Failed to delete file';

    // Check if error is an object and has the expected properties
    if (error && typeof error === 'object') {
      const apiError = error as ApiError;

      // Get status code if available
      if (apiError.response && typeof apiError.response.status === 'number') {
        statusCode = apiError.response.status;
      }

      // Get error message if available
      if (apiError.response?.data?.error) {
        errorMessage = apiError.response.data.error;
      } else if (apiError.message) {
        errorMessage = apiError.message;
      }
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    console.error(`Delete error details: Status ${statusCode}, Message: ${errorMessage}`);

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
