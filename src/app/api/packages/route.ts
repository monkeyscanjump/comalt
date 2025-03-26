export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import packages from '@/config/packages.json';
import fs from 'fs';
import { Package } from '@/types/packages';
import { authenticateRequest, createApiResponse, createErrorResponse } from '@/utils/apiAuth';
import { isTokenExpired } from '@/utils/api'; // Add this import

// GET handler for fetching packages
export async function GET(request: NextRequest) {
  console.log('GET /api/packages - Fetching packages list');

  try {
    // CRITICAL: Check token expiration before authentication
    if (isTokenExpired()) {
      console.log('[Packages API] Blocking request - token already known to be expired');
      return createErrorResponse('Token expired', 'TOKEN_EXPIRED', 401);
    }

    // Use the authentication utility
    const authResult = await authenticateRequest(request);
    if (authResult.error) return authResult.error;

    console.log('GET /api/packages - Auth result:', {
      authenticated: authResult.authenticated,
      publicMode: authResult.publicMode
    });

    // Get packages from the database for installation status
    const installedPackages = await prisma.appPackage.findMany();
    console.log(`Found ${installedPackages.length} package records in database`);

    installedPackages.forEach(pkg => {
      console.log(`DB Package ${pkg.id}: isInstalled=${pkg.isInstalled}`);
    });

    // Get package definitions from config file
    const packageDefinitions = (packages.packages || []) as any[];
    console.log(`Found ${packageDefinitions.length} package definitions in config`);

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
            console.log(`Package ${pkgDef.id} verification failed: ${verificationError}`);
          }
        } catch (error) {
          console.error(`Error verifying package ${pkgDef.id}:`, error);
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

    console.log(`Returning ${packageList.length} packages`);
    return createApiResponse(packageList);
  } catch (error) {
    console.error('Error in GET /api/packages:', error);
    return createErrorResponse(
      'Failed to fetch packages',
      'PACKAGE_FETCH_FAILED',
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
}

// POST handler for database repair
export async function POST(request: NextRequest) {
  console.log('POST /api/packages - Starting database repair');

  try {
    // CRITICAL: Check token expiration before authentication
    if (isTokenExpired()) {
      console.log('[Packages API] Blocking request - token already known to be expired');
      return createErrorResponse('Token expired', 'TOKEN_EXPIRED', 401);
    }

    // Use the authentication utility
    const authResult = await authenticateRequest(request);
    if (authResult.error) return authResult.error;

    console.log('POST /api/packages - Auth result:', {
      authenticated: authResult.authenticated,
      publicMode: authResult.publicMode
    });

    // Parse request body if available
    let repairOptions = {};
    try {
      repairOptions = await request.json();
    } catch (e) {
      // No body or invalid JSON - use defaults
      repairOptions = {};
    }

    console.log('Repair options:', repairOptions);

    // Get all packages that might need repair
    const packagesToCheck = await prisma.appPackage.findMany();
    console.log(`Found ${packagesToCheck.length} packages to check for repair`);

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
          console.log(`Repairing package ${id} (${name})`);

          // Determine reason for repair
          let reason = "Unknown issue";
          if (lastError) reason = "Has installation error";
          else if (!installPath) reason = "Missing install path";
          else if (!fs.existsSync(installPath)) reason = "Directory not found";
          else reason = "Directory empty";

          console.log(`Repair reason: ${reason}`);

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
        console.error(`Error repairing package ${pkg.id}:`, pkgError);
        errors.push({
          id: pkg.id,
          name: pkg.name,
          error: pkgError instanceof Error ? pkgError.message : String(pkgError)
        });
      }
    }

    return createApiResponse({
      success: true,
      repaired,
      errors,
      message: `Repaired ${repaired.length} package records${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
    });
  } catch (error) {
    console.error('Error in POST /api/packages:', error);
    return createErrorResponse(
      'Repair operation failed',
      'PACKAGE_REPAIR_FAILED',
      500,
      error instanceof Error ? error.message : String(error)
    );
  }
}
