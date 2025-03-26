export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs';
import { rimraf } from 'rimraf';
import { withApiRoute } from '@/middlewares/withApiRoute';

/**
 * Handle package uninstallation
 */
const handleUninstallPackage = async (request: NextRequest, context: { params?: any }) => {
  // Make sure params exist
  if (!context.params?.id) {
    const error = new Error('Missing package ID');
    (error as any).code = 'MISSING_PACKAGE_ID';
    (error as any).status = 400;
    throw error;
  }

  const { id } = context.params;
  console.log(`Starting uninstall process for package: ${id}`);

  // Find package in database
  const packageData = await prisma.appPackage.findUnique({
    where: { id }
  });

  if (!packageData) {
    console.log(`Package not found in database: ${id}`);
    const error = new Error('Package not found');
    (error as any).code = 'PACKAGE_NOT_FOUND';
    (error as any).status = 404;
    throw error;
  }

  console.log(`Package found: ${packageData.name}, isInstalled=${packageData.isInstalled}`);

  // Don't validate isInstalled status - always proceed with cleanup
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

  return NextResponse.json({
    success: true,
    message: `Package ${packageData.name} uninstalled successfully`,
    packageData: {
      id,
      isInstalled: false // Send this for client-side state updates
    }
  });
};

// Apply the wrapper to both POST and DELETE methods
export const POST = withApiRoute(handleUninstallPackage, {
  requireAuth: true,
  requireAdmin: true
});

// Support both DELETE and POST methods
export const DELETE = POST;
