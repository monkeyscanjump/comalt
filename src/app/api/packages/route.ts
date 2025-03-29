export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import packages from '@/config/packages.json';
import fs from 'fs';
import { Package } from '@/types/packages';
import { withApiRoute } from '@/middlewares/withApiRoute';

/**
 * Handler for fetching packages list
 */
const handleGetPackages = async (request: NextRequest) => {
  // Auth check is handled by withApiRoute middleware
  const authInfo = (request as any).auth;

  // Get packages from the database for installation status
  const installedPackages = await prisma.appPackage.findMany();

  // Get package definitions from config file
  const packageDefinitions = (packages.packages || []) as any[];

  // Merge package definitions with installation status
  const packageList = packageDefinitions.map(pkgDef => {
    const dbRecord = installedPackages.find((p: { id: string }) => p.id === pkgDef.id);

    // Determine if it's actually installed
    const isActuallyInstalled = dbRecord?.isInstalled === true;

    // If marked as installed, verify directory still exists
    let installVerified = isActuallyInstalled;
    let verificationError = null;

    if (isActuallyInstalled && dbRecord?.installPath) {
      try {
        const directoryExists = fs.existsSync(dbRecord.installPath);
        const isEmpty = directoryExists ?
          fs.readdirSync(dbRecord.installPath).length === 0 : true;

        if (!directoryExists || isEmpty) {
          installVerified = false;
          verificationError = !directoryExists ?
            "Installation directory not found" :
            "Installation directory is empty";
        }
      } catch (error) {
        installVerified = false;
        verificationError = "Error verifying installation";
      }
    }

    // Create the full package object
    const fullPackage = {
      ...pkgDef,
      isInstalled: installVerified,
      installedVersion: dbRecord?.installedVersion || null,
      installedAt: dbRecord?.installedAt ? dbRecord.installedAt.toISOString() : null,
      installPath: dbRecord?.installPath || pkgDef.defaultInstallPath || null,
      lastCheckedAt: dbRecord?.lastCheckedAt ? dbRecord.lastCheckedAt.toISOString() : null,
      lastError: verificationError || dbRecord?.lastError || null,
      requiresRepair: isActuallyInstalled !== installVerified
    } as Package & { requiresRepair: boolean };

    return fullPackage;
  });

  return NextResponse.json(packageList);
};

/**
 * Handler for database repair
 */
const handleRepairPackages = async (request: NextRequest) => {
  // Auth is handled by middleware
  const authInfo = (request as any).auth;

  // Parse request body if available
  let repairOptions = {};
  try {
    repairOptions = await request.json();
  } catch (e) {
    // No body or invalid JSON - use defaults
    repairOptions = {};
  }

  // Get all packages that might need repair
  const packagesToCheck = await prisma.appPackage.findMany();

  const repaired = [];
  const errors = [];

  // Check each package
  for (const pkg of packagesToCheck) {
    try {
      const { id, name, installPath, lastError, isInstalled } = pkg;

      // Conditions for repair:
      // 1. Marked as installed but has error
      // 2. Marked as installed but has no path
      // 3. Marked as installed but path doesn't exist or is empty
      const needsRepair = isInstalled && (
        lastError ||
        !installPath ||
        (installPath && (!fs.existsSync(installPath) || fs.readdirSync(installPath).length === 0))
      );

      if (needsRepair) {
        // Determine reason for repair
        let reason = "Unknown issue";
        if (lastError) reason = "Has installation error";
        else if (!installPath) reason = "Missing install path";
        else if (!fs.existsSync(installPath)) reason = "Directory not found";
        else reason = "Directory empty";

        // Update database to mark as not installed
        await prisma.appPackage.update({
          where: { id },
          data: {
            isInstalled: false,
            installedVersion: null,
            installedAt: null,
            lastCheckedAt: new Date(),
            lastError: `Fixed by database repair: ${reason.toLowerCase()}`
          }
        });

        repaired.push({
          id,
          name,
          reason
        });
      }
    } catch (pkgError) {
      errors.push({
        id: pkg.id,
        name: pkg.name,
        error: pkgError instanceof Error ? pkgError.message : String(pkgError)
      });
    }
  }

  return NextResponse.json({
    success: true,
    repaired,
    errors,
    message: `Repaired ${repaired.length} package records${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
  });
};

// Export the handlers with the API route wrapper
export const GET = withApiRoute(handleGetPackages, {
  requireAuth: true  // This replaces authenticateRequest
});

export const POST = withApiRoute(handleRepairPackages, {
  requireAuth: true, // This replaces authenticateRequest
  requireAdmin: true // Require admin for repair operation
});
