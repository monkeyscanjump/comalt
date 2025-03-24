export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { extractTokenFromHeader, verifyToken } from '@/utils/auth';
import fs from 'fs';
import { rimraf } from 'rimraf';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log(`Starting uninstall process for package: ${params.id}`);

  try {
    // Get token from request header
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      console.log(`Unauthorized: No token provided`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the token
    const payload = verifyToken(token);
    if (!payload) {
      console.log(`Unauthorized: Invalid token`);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get package ID from params
    const { id } = params;
    console.log(`Looking up package: ${id}`);

    // Find package in database
    const packageData = await prisma.appPackage.findUnique({
      where: { id }
    });

    if (!packageData) {
      console.log(`Package not found in database: ${id}`);
      return NextResponse.json(
        { error: 'Package not found' },
        { status: 404 }
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

    // Add cache prevention headers
    const headers = new Headers();
    headers.append('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.append('Pragma', 'no-cache');
    headers.append('Expires', '0');

    return NextResponse.json({
      success: true,
      message: `Package ${packageData.name} uninstalled successfully`,
      packageData: {
        id,
        isInstalled: false // Send this for client-side state updates
      }
    }, { headers });
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

    return NextResponse.json(
      {
        error: 'Failed to uninstall package',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

// Support both DELETE and POST methods
export const DELETE = POST;
