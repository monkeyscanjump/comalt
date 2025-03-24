export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import packages from '@/config/packages.json';
import { extractTokenFromHeader, verifyToken } from '@/utils/auth';
import { execSync } from 'child_process';
import fs from 'fs';
import { getCommandsAsArray } from '@/types/packages';

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log(`Starting install process for package: ${params.id}`);

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

    // Find package in definitions
    const packageDef = packages.packages.find((p: any) => p.id === id);
    if (!packageDef) {
      console.log(`Package definition not found: ${id}`);
      return NextResponse.json(
        { error: 'Package not found' },
        { status: 404 }
      );
    }

    console.log(`Found package definition: ${packageDef.name}`);

    // Get request body for custom install path
    const body = await request.json();
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
    try {
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
    } catch (dbError) {
      console.error("Database error during package upsert:", dbError);
      throw new Error(`Database error: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
    }

    // Add cache prevention headers
    const headers = new Headers();
    headers.append('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.append('Pragma', 'no-cache');
    headers.append('Expires', '0');

    return NextResponse.json({
      success: true,
      message: `Package ${packageDef.name} installed successfully`,
      installedVersion: version,
      installPath: normalizedPath,
      packageData: {
        id,
        isInstalled: true // For client-side state updates
      }
    }, { headers });
  } catch (error) {
    console.error(`Error installing package ${params.id}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Record error in database
    if (params?.id) {
      try {
        // Check if the package exists first
        const existingPackage = await prisma.appPackage.findUnique({
          where: { id: params.id }
        });

        if (existingPackage) {
          // Update only if it exists
          await prisma.appPackage.update({
            where: { id: params.id },
            data: {
              isInstalled: false, // Important: set to false when installation fails
              lastError: errorMessage,
              lastCheckedAt: new Date()
            }
          });
          console.log(`Updated existing package record with error status`);
        } else {
          // Create a new record if it doesn't exist
          const packageDef = packages.packages.find((p: any) => p.id === params.id);
          await prisma.appPackage.create({
            data: {
              id: params.id,
              name: packageDef?.name || params.id,
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

    return NextResponse.json(
      {
        error: 'Failed to install package',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
