export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import packages from '@/config/packages.json';
import { execSync } from 'child_process';
import fs from 'fs';
import { getCommandsAsArray } from '@/types/packages';
import { withApiRoute } from '@/middlewares/withApiRoute';

// Helper function to safely execute commands
function safeExecSync(command: string, options: any = {}): string {
  try {
    // Default options that work better on Windows
    const defaultOptions = {
      stdio: 'pipe', // Capture output
      shell: true,   // Use shell on Windows
      timeout: 300000, // 5 minute timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for command output
      windowsHide: true // Hide the console window
    };

    const mergedOptions = { ...defaultOptions, ...options };
    console.log(`Executing: ${command}`);

    const output = execSync(command, mergedOptions);
    return output.toString();
  } catch (error) {
    console.error(`Command failed: ${command}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Command failed: ${command}\n${errorMessage}`);
  }
}

/**
 * Handle package installation
 */
const handlePackageInstall = async (request: NextRequest, context: { params?: any }) => {
  try {
    // Make sure params exist
    if (!context.params?.id) {
      const error = new Error('Missing package ID');
      (error as any).code = 'MISSING_PACKAGE_ID';
      (error as any).status = 400;
      throw error;
    }

    const id = context.params.id;
    console.log(`Starting install process for package: ${id}`);

    // Find package in definitions
    const packageDef = packages.packages.find((p: any) => p.id === id);
    if (!packageDef) {
      console.log(`Package definition not found: ${id}`);
      const error = new Error('Package not found');
      (error as any).code = 'PACKAGE_NOT_FOUND';
      (error as any).status = 404;
      throw error;
    }

    console.log(`Found package definition: ${packageDef.name}`);

    // Get request body for custom install path
    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.log('No valid JSON body, using defaults');
      body = {};
    }

    const installPath = body.installPath || packageDef.defaultInstallPath;

    // Normalize path for Windows
    const normalizedPath = installPath.replace(/\//g, '\\');
    console.log(`Install path: ${normalizedPath}`);

    // Make sure install path exists
    if (!fs.existsSync(normalizedPath)) {
      console.log(`Creating directory: ${normalizedPath}`);
      fs.mkdirSync(normalizedPath, { recursive: true });
    }

    // Check if directory already exists and is not empty
    if (fs.existsSync(normalizedPath) && fs.readdirSync(normalizedPath).length > 0) {
      console.log(`Directory ${normalizedPath} already exists and is not empty. Skipping git clone.`);
    } else {
      // Clone repository
      console.log(`Cloning repository: ${packageDef.githubUrl}`);
      safeExecSync(`git clone ${packageDef.githubUrl} "${normalizedPath}"`);
    }

    // Run install commands
    console.log(`Running install commands`);
    const commands = getCommandsAsArray(packageDef.installCommands);
    for (const cmd of commands) {
      const resolvedCmd = cmd.replace(/\{\{installPath\}\}/g, normalizedPath);

      // Skip yarn/npm install commands that might conflict with the running server
      if (resolvedCmd.includes('yarn install') || resolvedCmd.includes('npm install')) {
        console.log(`Skipping potentially conflicting command: ${resolvedCmd}`);
        continue;
      }

      safeExecSync(resolvedCmd, { cwd: normalizedPath });
    }

    // Get git version information
    let version;
    try {
      console.log(`Getting git version information`);
      version = safeExecSync('git describe --tags --always', {
        cwd: normalizedPath,
      }).trim();
      console.log(`Git version: ${version}`);
    } catch (versionError) {
      console.warn("Failed to get git version, using fallback:", versionError);
      version = "unknown";
    }

    // Create or update package in database
    const now = new Date();
    console.log(`Updating database`);
    const updatedPackage = await prisma.appPackage.upsert({
      where: { id },
      update: {
        isInstalled: true,
        installedVersion: version,
        installPath: normalizedPath,
        installedAt: now,
        lastCheckedAt: now,
        lastError: null
      },
      create: {
        id,
        name: packageDef.name,
        description: packageDef.description || '',
        githubUrl: packageDef.githubUrl,
        installCommands: Array.isArray(packageDef.installCommands)
          ? JSON.stringify(packageDef.installCommands)
          : packageDef.installCommands,
        isInstalled: true,
        installedVersion: version,
        installPath: normalizedPath,
        installedAt: now,
        lastCheckedAt: now
      }
    });
    console.log(`Database updated, isInstalled=${updatedPackage.isInstalled}`);

    return NextResponse.json({
      success: true,
      message: `Package ${packageDef.name} installed successfully`,
      installedVersion: version,
      installPath: normalizedPath,
      packageData: {
        id,
        isInstalled: true // For client-side state updates
      }
    });
  } catch (error) {
    // Add error handling to record failures in the database
    console.error(`Error installing package ${context.params?.id}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Record error in database
    if (context.params?.id) {
      try {
        // Check if the package exists first
        const existingPackage = await prisma.appPackage.findUnique({
          where: { id: context.params.id }
        });

        if (existingPackage) {
          // Update only if it exists
          await prisma.appPackage.update({
            where: { id: context.params.id },
            data: {
              isInstalled: false, // Important: set to false when installation fails
              lastError: errorMessage,
              lastCheckedAt: new Date()
            }
          });
          console.log(`Updated existing package record with error status`);
        } else {
          // Create a new record if it doesn't exist
          const packageDef = packages.packages.find((p: any) => p.id === context.params.id);
          await prisma.appPackage.create({
            data: {
              id: context.params.id,
              name: packageDef?.name || context.params.id,
              description: packageDef?.description || "Package installation failed",
              githubUrl: packageDef?.githubUrl || "",
              installCommands: packageDef?.installCommands
                ? (Array.isArray(packageDef.installCommands)
                  ? JSON.stringify(packageDef.installCommands)
                  : packageDef.installCommands)
                : "[]",
              isInstalled: false, // Important: set to false on creation when there's an error
              lastError: errorMessage,
              lastCheckedAt: new Date()
            }
          });
          console.log(`Created new package record with error status`);
        }
      } catch (dbError) {
        console.error('Failed to update package error status:', dbError);
      }
    }

    // Re-throw the error so withApiRoute can handle it
    throw error;
  }
};

// Export the handler with the withApiRoute wrapper
export const POST = withApiRoute(handlePackageInstall, {
  requireAuth: true,
  requireAdmin: true // Require admin privileges for package installation
});
