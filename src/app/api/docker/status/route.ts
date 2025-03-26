export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { withApiRoute } from '@/middlewares/withApiRoute';
import path from 'path';
import * as fsPromises from 'fs/promises';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Handle Docker status check request
 */
const handleDockerStatus = async (request: NextRequest) => {
  console.log('GET /api/docker/status - Checking Docker status');

  // Auth is handled by the middleware if required
  // We can check if this is an internal request (no auth needed)
  const isInternalRequest = request.headers.get('X-Internal-Request') === 'true';

  // Check if progress info was requested
  const url = new URL(request.url);
  const wantProgress = url.searchParams.get('progress') === 'true';

  // If progress is requested, check the installation status file
  if (wantProgress) {
    try {
      const statusFile = path.join(os.tmpdir(), 'docker-install-status.json');
      if (!fs.existsSync(statusFile)) {
        return NextResponse.json({
          status: 'unknown'
        });
      }

      const status = JSON.parse(await fsPromises.readFile(statusFile, 'utf-8'));

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
      // Status file doesn't exist or couldn't be read
      console.warn('Error reading Docker install status file:', err);
      return NextResponse.json({
        status: 'unknown'
      });
    }
  }

  // Check if Docker is installed by running docker --version
  console.log('Checking Docker installation with docker --version command');

  // First attempt with normal command
  try {
    const { stdout } = await execAsync('docker --version', {
      timeout: 5000,
      env: { ...process.env, PATH: process.env.PATH }
    });

    console.log('Docker version found:', stdout.trim());

    return NextResponse.json({
      installed: true,
      version: stdout.trim()
    });
  } catch (primaryErr) {
    console.log('Primary Docker check failed, trying alternative methods');

    // Try with full path on Windows
    if (process.platform === 'win32') {
      try {
        // Check common Windows Docker paths
        const possiblePaths = [
          'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
          'C:\\Program Files\\Docker\\Docker\\Docker for Windows.exe',
          'C:\\ProgramData\\DockerDesktop\\version-bin\\docker.exe'
        ];

        for (const dockerPath of possiblePaths) {
          if (fs.existsSync(dockerPath)) {
            console.log(`Found Docker at: ${dockerPath}`);

            const { stdout } = await execAsync(`"${dockerPath}" --version`, {
              timeout: 5000
            });

            return NextResponse.json({
              installed: true,
              version: stdout.trim(),
              path: dockerPath
            });
          }
        }

        throw new Error('Docker executable not found in expected locations');
      } catch (windowsErr) {
        console.warn('Windows Docker detection failed:', windowsErr);
      }
    } else {
      // For Linux/Mac, check if the service is running
      try {
        if (process.platform === 'linux') {
          const { stdout: serviceOutput } = await execAsync('systemctl is-active docker', { timeout: 3000 });
          if (serviceOutput.trim() === 'active') {
            return NextResponse.json({
              installed: true,
              version: 'Service active (version check failed)',
              note: 'Docker service is running but version check failed'
            });
          }
        } else if (process.platform === 'darwin') {
          // Mac check for Docker.app
          const { stdout: appOutput } = await execAsync('ls -la /Applications/Docker.app', { timeout: 3000 });
          if (appOutput) {
            return NextResponse.json({
              installed: true,
              version: 'App installed (version check failed)',
              note: 'Docker app is installed but version check failed'
            });
          }
        }
      } catch (serviceErr) {
        console.warn('Service check failed:', serviceErr);
      }
    }

    // Log details about the Docker detection failure
    console.warn('All Docker detection methods failed:', primaryErr instanceof Error ? primaryErr.message : String(primaryErr));

    return NextResponse.json({
      installed: false,
      error: primaryErr instanceof Error ? primaryErr.message : 'Failed to execute Docker command'
    });
  }
};

// Export the GET handler with the API route wrapper
// Only require auth if it's not an internal request
export const GET = withApiRoute(handleDockerStatus, {
  // Authentication is conditionally handled in the handler for internal requests
  requireAuth: true
});
