import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getAuthToken, errorResponse, validateAuthToken } from '@/utils/api';
import { isPublicMode } from '@/lib/whitelist-server';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  try {
    // Check authorization
    const publicMode = isPublicMode();

    if (!publicMode) {
      const token = getAuthToken(request);

      if (!token) {
        return errorResponse('Authentication required', 'AUTH_REQUIRED', 401);
      }

      const tokenResult = await validateAuthToken(token);

      if (!tokenResult.valid) {
        return errorResponse(
          tokenResult.error || 'Invalid token',
          tokenResult.errorCode || 'INVALID_TOKEN',
          401
        );
      }

      // Admin check
      if (tokenResult.isAdmin !== true) {
        return errorResponse('Admin privileges required', 'ADMIN_REQUIRED', 403);
      }
    }

    // Check if progress info was requested
    const url = new URL(request.url);
    const wantProgress = url.searchParams.get('progress') === 'true';

    // If progress is requested, check the installation status file
    if (wantProgress) {
      try {
        const statusFile = path.join(os.tmpdir(), 'docker-install-status.json');
        const status = JSON.parse(await fs.readFile(statusFile, 'utf-8'));

        if (status.status === 'completed' && status.version) {
          return NextResponse.json({
            status: 'completed',
            version: status.version,
            installed: true
          });
        }

        if (status.log) {
          return NextResponse.json({
            status: status.status,
            log: status.log
          });
        }

        if (status.error) {
          return NextResponse.json({
            status: 'error',
            error: status.error
          });
        }

        return NextResponse.json(status);
      } catch (err) {
        // Status file doesn't exist yet
        return NextResponse.json({
          status: 'unknown'
        });
      }
    }

    // Check if Docker is installed by running docker --version
    try {
      const { stdout } = await execAsync('docker --version');
      return NextResponse.json({
        installed: true,
        version: stdout.trim()
      });
    } catch (err) {
      return NextResponse.json({
        installed: false
      });
    }
  } catch (err) {
    console.error('Error in Docker status API:', err);
    return errorResponse(
      'Failed to check Docker status',
      'DOCKER_STATUS_ERROR',
      500
    );
  }
}
