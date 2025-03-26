import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { authenticateRequest, createApiResponse, createErrorResponse } from '@/utils/apiAuth';
import { isTokenExpired, processApiError } from '@/utils/api'; // Add these imports
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    // CRITICAL: Check token expiration before authentication
    if (isTokenExpired()) {
      console.log('[Docker Install] Blocking request - token already known to be expired');
      return createErrorResponse('Token expired', 'TOKEN_EXPIRED', 401);
    }

    // Check authorization using our utility
    const authResult = await authenticateRequest(request, true); // Require admin
    if (authResult.error) return authResult.error;

    console.log('[Docker Install] Auth successful, proceeding with installation');

    // Get installation options from request body
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('[Docker Install] Failed to parse request body:', jsonError);
      return createErrorResponse(
        'Invalid request body',
        'INVALID_REQUEST',
        400
      );
    }

    const { platform, distro, includeCompose = true } = body;

    // Validate platform parameter
    if (!platform) {
      return createErrorResponse(
        'Platform parameter is required',
        'MISSING_PARAMETER',
        400
      );
    }

    // Create temp directory for installation files
    const tempDir = path.join(os.tmpdir(), 'docker-install');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      console.log('[Docker Install] Temp directory already exists or creation failed');
    }

    // Create a log file for installation progress
    const logFile = path.join(tempDir, 'install.log');
    await fs.writeFile(logFile, 'Starting Docker installation...\n');

    // Create status file
    const statusFile = path.join(os.tmpdir(), 'docker-install-status.json');
    await fs.writeFile(
      statusFile,
      JSON.stringify({
        status: 'installing',
        log: 'Starting Docker installation...',
        timestamp: new Date().toISOString()
      })
    );

    // Determine installation command based on platform
    let installScript = '';

    if (platform === 'linux') {
      // For Linux, we'll use the convenience script
      installScript = `
        curl -fsSL https://get.docker.com -o ${path.join(tempDir, 'get-docker.sh')} &&
        sudo sh ${path.join(tempDir, 'get-docker.sh')} 2>&1 | tee -a ${logFile} &&
        echo "Adding current user to docker group..." >> ${logFile} &&
        sudo usermod -aG docker $USER 2>&1 | tee -a ${logFile} &&
        ${includeCompose ? `
          echo "Installing Docker Compose..." >> ${logFile} &&
          sudo apt-get update -qq &&
          sudo apt-get install -qq docker-compose-plugin 2>&1 | tee -a ${logFile} &&
        ` : ''}
        echo "Installation completed successfully!" >> ${logFile} &&
        docker --version > ${path.join(tempDir, 'version.txt')} 2>&1
      `;
    } else if (platform === 'win32') {
      // For Windows, direct download of installer
      installScript = `
        echo "Downloading Docker Desktop for Windows..." >> ${logFile} &&
        curl -fsSL -o ${path.join(tempDir, 'DockerDesktopInstaller.exe')} https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe &&
        echo "Please run the downloaded installer manually. We cannot automatically install Docker Desktop." >> ${logFile} &&
        echo "Installation package downloaded to: ${path.join(tempDir, 'DockerDesktopInstaller.exe')}" >> ${logFile}
      `;
    } else if (platform === 'darwin') {
      // For macOS, direct download of installer
      installScript = `
        echo "Downloading Docker Desktop for Mac..." >> ${logFile} &&
        curl -fsSL -o ${path.join(tempDir, 'Docker.dmg')} https://desktop.docker.com/mac/main/amd64/Docker.dmg &&
        echo "Please mount the downloaded DMG and install Docker Desktop manually. We cannot automatically install Docker Desktop." >> ${logFile} &&
        echo "Installation package downloaded to: ${path.join(tempDir, 'Docker.dmg')}" >> ${logFile}
      `;
    } else {
      return createErrorResponse(`Unsupported platform: ${platform}`, 'UNSUPPORTED_PLATFORM', 400);
    }

    // Execute installation in background
    exec(installScript, async (error, stdout, stderr) => {
      try {
        if (error) {
          console.error(`[Docker Install] Installation error: ${error.message}`);
          await fs.appendFile(logFile, `\nError: ${error.message}\n`);
          await fs.writeFile(
            statusFile,
            JSON.stringify({
              status: 'error',
              error: error.message,
              log: await fs.readFile(logFile, 'utf-8'),
              timestamp: new Date().toISOString()
            })
          );
          return;
        }

        console.log('[Docker Install] Installation command completed');

        // Check if installation was successful by running docker --version
        try {
          const { stdout: versionOutput } = await execAsync('docker --version');
          console.log('[Docker Install] Docker version check successful:', versionOutput.trim());

          await fs.appendFile(logFile, `\nDocker installed successfully: ${versionOutput}\n`);
          await fs.writeFile(
            statusFile,
            JSON.stringify({
              status: 'completed',
              version: versionOutput.trim(),
              log: await fs.readFile(logFile, 'utf-8'),
              timestamp: new Date().toISOString()
            })
          );
        } catch (versionErr) {
          // Docker command not found, might need a system restart
          console.log('[Docker Install] Docker version check failed, may need restart');

          await fs.appendFile(logFile, '\nInstallation may require a system restart.\n');
          await fs.writeFile(
            statusFile,
            JSON.stringify({
              status: 'completed',
              note: 'A system restart may be required',
              log: await fs.readFile(logFile, 'utf-8'),
              timestamp: new Date().toISOString()
            })
          );
        }
      } catch (fsErr) {
        console.error('[Docker Install] Error writing installation logs:', fsErr);

        // Try to update status file with the error
        try {
          await fs.writeFile(
            statusFile,
            JSON.stringify({
              status: 'error',
              error: fsErr instanceof Error ? fsErr.message : String(fsErr),
              timestamp: new Date().toISOString()
            })
          );
        } catch (statusErr) {
          console.error('[Docker Install] Could not update status file with error:', statusErr);
        }
      }
    });

    // Return immediate response
    return createApiResponse({
      message: 'Docker installation started',
      status: 'installing',
      logFile,
      statusFile
    });

  } catch (err) {
    console.error('[Docker Install] Error in Docker installation API:', err);

    // Process the error through the global handler to detect token expiration
    processApiError(err);

    return createErrorResponse(
      'Failed to start Docker installation',
      'DOCKER_INSTALL_ERROR',
      500,
      err instanceof Error ? err.message : String(err)
    );
  }
}
