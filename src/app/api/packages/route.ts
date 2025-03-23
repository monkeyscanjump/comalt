export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import packages from '@/config/packages.json';
import { extractTokenFromHeader, verifyToken } from '@/utils/auth';
import { execSync } from 'child_process';
import fs from 'fs';
import { Package } from '@/types/packages';

// List all packages and their status
export async function GET(request: NextRequest) {
  try {
    // Get token from request header
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the token
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get installed packages from the database
    const installedPackages = await prisma.appPackage.findMany();

    // Merge installed status with package definitions
    const packageList = (packages.packages as any[]).map(pkgDef => {
      const installed = installedPackages.find((p: { id: string }) => p.id === pkgDef.id);

      return {
        ...pkgDef,
        isInstalled: !!installed,
        installedVersion: installed?.installedVersion || null,
        installedAt: installed?.installedAt ? installed.installedAt.toISOString() : null,
        installPath: installed?.installPath || pkgDef.defaultInstallPath || null,
        lastCheckedAt: installed?.lastCheckedAt ? installed.lastCheckedAt.toISOString() : null,
        lastError: installed?.lastError || null
      } as Package;
    });

    return NextResponse.json(packageList);
  } catch (error) {
    console.error('Error fetching packages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch packages', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get token from request header
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the token
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get package ID from params
    const { id } = params;

    // Find package in definitions
    const packageDef = packages.packages.find(p => p.id === id);
    if (!packageDef) {
      return NextResponse.json(
        { error: 'Package not found' },
        { status: 404 }
      );
    }

    // Get request body for custom install path
    const body = await request.json();
    const installPath = body.installPath || packageDef.defaultInstallPath;

    // Make sure install path exists
    if (!fs.existsSync(installPath)) {
      fs.mkdirSync(installPath, { recursive: true });
    }

    // Clone repository
    execSync(`git clone ${packageDef.githubUrl} ${installPath}`, {
      stdio: 'inherit'
    });

    // Run install commands
    for (const cmd of packageDef.installCommands) {
      const resolvedCmd = cmd.replace(/\{\{installPath\}\}/g, installPath);
      execSync(resolvedCmd, { stdio: 'inherit' });
    }

    // Get git version information
    const version = execSync('git describe --tags --always', {
      cwd: installPath,
      encoding: 'utf-8'
    }).trim();

    // Create or update package in database - use lowercase for model name
    const now = new Date();
    await prisma.appPackage.upsert({
      where: { id },
      update: {
        isInstalled: true,
        installedVersion: version,
        installPath,
        installedAt: now,
        lastCheckedAt: now,
        lastError: null
      },
      create: {
        id,
        name: packageDef.name,
        description: packageDef.description,
        githubUrl: packageDef.githubUrl,
        installCommands: Array.isArray(packageDef.installCommands)
          ? JSON.stringify(packageDef.installCommands)
          : packageDef.installCommands,
        isInstalled: true,
        installedVersion: version,
        installPath,
        installedAt: now,
        lastCheckedAt: now
      }
    });

    return NextResponse.json({
      success: true,
      message: `Package ${packageDef.name} installed successfully`,
      installedVersion: version,
      installPath
    });
  } catch (error) {
    console.error(`Error installing package ${params?.id}:`, error);

    // Record error in database - use lowercase for model name
    if (params?.id) {
      try {
        await prisma.appPackage.update({
          where: { id: params.id },
          data: {
            lastError: error instanceof Error ? error.message : String(error),
            lastCheckedAt: new Date()
          }
        });
      } catch (dbError) {
        console.error('Failed to update package error status:', dbError);
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to install package',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
