export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { authenticateRequest, createApiResponse, createErrorResponse } from '@/utils/apiAuth';
import { isTokenExpired, processApiError } from '@/utils/api';
import path from 'path';
import * as fsPromises from 'fs/promises';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  try {
    // CRITICAL: Check token expiration before authentication
    if (isTokenExpired()) {
      console.log('[Docker API] Blocking request - token already known to be expired');
      return createErrorResponse('Token expired', 'TOKEN_EXPIRED', 401);
    }

    // Maintain proper authentication - only authorized users or public mode
    const authResult = await authenticateRequest(request);
    if (authResult.error) return authResult.error;

    console.log('GET /api/docker/status - Auth result:', {
      authenticated: authResult.authenticated,
      publicMode: authResult.publicMode
    });

    // Check if progress info was requested
    const url = new URL(request.url);
    const wantProgress = url.searchParams.get('progress') === 'true';

    // If progress is requested, check the installation status file
    if (wantProgress) {
      try {
        const statusFile = path.join(os.tmpdir(), 'docker-install-status.json');
        if (!fs.existsSync(statusFile)) {
          return createApiResponse({
            status: 'unknown'
          });
        }

        const status = JSON.parse(await fsPromises.readFile(statusFile, 'utf-8'));

        if (status.status === 'completed' && status.version) {
          return createApiResponse({
            status: 'completed',
            version: status.version,
            installed: true
          });
        }

        if (status.log) {
          return createApiResponse({
            status: status.status,
            log: status.log
          });
        }

        if (status.error) {
          return createApiResponse({
            status: 'error',
            error: status.error
          });
        }

        return createApiResponse(status);
      } catch (err) {
        // Status file doesn't exist or couldn't be read
        console.warn('Error reading Docker install status file:', err);
        return createApiResponse({
          status: 'unknown'
        });
      }
    }

    // Check if Docker is installed by running docker --version
    try {
      console.log('Checking Docker installation with docker --version command');

      // First attempt with normal command
      try {
        const { stdout } = await execAsync('docker --version', {
          timeout: 5000,
          env: { ...process.env, PATH: process.env.PATH }
        });

        console.log('Docker version found:', stdout.trim());

        return createApiResponse({
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
              if (fs.existsSync(dockerPath)) {  // Using synchronous existsSync from regular fs
                console.log(`Found Docker at: ${dockerPath}`);

                const { stdout } = await execAsync(`"${dockerPath}" --version`, {
                  timeout: 5000
                });

                return createApiResponse({
                  installed: true,
                  version: stdout.trim(),
                  path: dockerPath
                });
              }
            }

            throw new Error('Docker executable not found in expected locations');
          } catch (windowsErr) {
            console.warn('Windows Docker detection failed:', windowsErr);
            throw primaryErr; // Rethrow the original error
          }
        } else {
          // For Linux/Mac, check if the service is running
          try {
            if (process.platform === 'linux') {
              const { stdout: serviceOutput } = await execAsync('systemctl is-active docker', { timeout: 3000 });
              if (serviceOutput.trim() === 'active') {
                return createApiResponse({
                  installed: true,
                  version: 'Service active (version check failed)',
                  note: 'Docker service is running but version check failed'
                });
              }
            } else if (process.platform === 'darwin') {
              // Mac check for Docker.app
              const { stdout: appOutput } = await execAsync('ls -la /Applications/Docker.app', { timeout: 3000 });
              if (appOutput) {
                return createApiResponse({
                  installed: true,
                  version: 'App installed (version check failed)',
                  note: 'Docker app is installed but version check failed'
                });
              }
            }
          } catch (serviceErr) {
            console.warn('Service check failed:', serviceErr);
          }

          throw primaryErr; // Rethrow the original error
        }
      }
    } catch (err) {
      // Log details about the Docker detection failure
      console.warn('All Docker detection methods failed:', err instanceof Error ? err.message : String(err));

      return createApiResponse({
        installed: false,
        error: err instanceof Error ? err.message : 'Failed to execute Docker command'
      });
    }
  } catch (err) {
    console.error('Error in Docker status API:', err);

    // Process the error through the global handler to detect token expiration
    processApiError(err);

    return createErrorResponse(
      'Failed to check Docker status',
      'DOCKER_STATUS_ERROR',
      500,
      err instanceof Error ? err.message : String(err)
    );
  }
}
