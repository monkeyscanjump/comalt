export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs';
import { rimraf } from 'rimraf';
import { authenticateRequest, createApiResponse, createErrorResponse } from '@/utils/apiAuth';
import { isTokenExpired } from '@/utils/api';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log(`Starting uninstall process for package: ${params.id}`);

  try {
    // CRITICAL: Check token expiration before authentication
    if (isTokenExpired()) {
      console.log('[Package Uninstall] Blocking request - token already known to be expired');
      return createErrorResponse('Token expired', 'TOKEN_EXPIRED', 401);
    }

    // Use the authentication utility
    const authResult = await authenticateRequest(request);
    if (authResult.error) return authResult.error;

    // Log authentication result
    console.log(`Uninstall Package - Auth result: authenticated=${authResult.authenticated}, publicMode=${authResult.publicMode}`);

    // Get package ID from params
    const { id } = params;
    console.log(`Looking up package: ${id}`);

    // Find package in database
    const packageData = await prisma.appPackage.findUnique({
      where: { id }
    });

    if (!packageData) {
      console.log(`Package not found in database: ${id}`);
      return createErrorResponse(
        'Package not found',
        'PACKAGE_NOT_FOUND',
        404
      );
    }

    console.log(`Package found: ${packageData.name}, isInstalled=${packageData.isInstalled}`);

    // Don't validate isInstalled status - always proceed with cleanup
    // REMOVED: if (!packageData.isInstalled) check

    const installPath = packageData.installPath;
    console.log(`Install path: ${installPath}`);

    // Try to delete directory if path exists and is valid
    if (installPath &&
        installPath.trim() !== '' &&
        installPath !== '/' &&
        installPath !== 'C:\\' &&
        installPath !== process.cwd()) {

      if (fs.existsSync(installPath)) {
        try {
          console.log(`Removing directory: ${installPath}`);
          await rimraf(installPath);
          console.log(`Directory removed successfully`);
        } catch (deleteError) {
          console.error(`Error deleting directory:`, deleteError);
          // Don't throw - continue with database update
          console.log(`Failed to delete directory, but will continue with database update`);
        }
      } else {
        console.log(`Directory does not exist: ${installPath}`);
      }
    } else {
      console.log(`Invalid install path, skipping directory deletion`);
    }

    // Always update package in database - this is the critical part
    const now = new Date();
    console.log(`Updating database to mark package as uninstalled`);
    const updatedPackage = await prisma.appPackage.update({
      where: { id },
      data: {
        isInstalled: false,
        installedVersion: null,
        installedAt: null,
        lastCheckedAt: now,
        lastError: null
      }
    });

    console.log(`Database updated, new isInstalled value: ${updatedPackage.isInstalled}`);

    return createApiResponse({
      success: true,
      message: `Package ${packageData.name} uninstalled successfully`,
      packageData: {
        id,
        isInstalled: false // Send this for client-side state updates
      }
    });
  } catch (error) {
    console.error(`Error uninstalling package ${params.id}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Record error in database
    if (params?.id) {
      try {
        // Check if the package exists first
        const existingPackage = await prisma.appPackage.findUnique({
          where: { id: params.id }
        });

        if (existingPackage) {
          await prisma.appPackage.update({
            where: { id: params.id },
            data: {
              lastError: errorMessage,
              lastCheckedAt: new Date()
            }
          });
          console.log(`Updated package record with error status`);
        }
      } catch (dbError) {
        console.error('Failed to update package error status:', dbError);
      }
    }

    return createErrorResponse(
      'Failed to uninstall package',
      'UNINSTALL_FAILED',
      500,
      errorMessage
    );
  }
}

// Support both DELETE and POST methods
export const DELETE = POST;
