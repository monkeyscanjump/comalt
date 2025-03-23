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

    // Find package in database
    const packageData = await prisma.appPackage.findUnique({
      where: { id }
    });

    if (!packageData) {
      return NextResponse.json(
        { error: 'Package not installed' },
        { status: 404 }
      );
    }

    if (!packageData.isInstalled) {
      return NextResponse.json(
        { error: 'Package not installed' },
        { status: 400 }
      );
    }

    const installPath = packageData.installPath;

    // Validate the installPath before attempting to delete
    if (!installPath || installPath.trim() === '' || installPath === '/' || installPath === 'C:\\') {
      return NextResponse.json(
        { error: 'Invalid install path' },
        { status: 400 }
      );
    }

    // Check if path exists
    if (fs.existsSync(installPath)) {
      try {
        // Use rimraf for safer directory deletion, especially on Windows
        await rimraf(installPath);
      } catch (deleteError) {
        console.error('Error deleting directory:', deleteError);
        throw new Error(`Failed to delete directory: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`);
      }
    }

    // Update package in database
    const now = new Date();
    await prisma.appPackage.update({
      where: { id },
      data: {
        isInstalled: false,
        installedVersion: null,
        installedAt: null,
        lastCheckedAt: now,
        lastError: null
      }
    });

    return NextResponse.json({
      success: true,
      message: `Package ${packageData.name} uninstalled successfully`
    });
  } catch (error) {
    console.error(`Error uninstalling package ${params.id}:`, error);

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
              lastError: error instanceof Error ? error.message : String(error),
              lastCheckedAt: new Date()
            }
          });
        }
      } catch (dbError) {
        console.error('Failed to update package error status:', dbError);
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to uninstall package',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
