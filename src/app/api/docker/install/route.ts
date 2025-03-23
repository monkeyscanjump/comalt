import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getAuthToken, errorResponse, validateAuthToken } from '@/utils/api';
import { isPublicMode } from '@/lib/whitelist-server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
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

    // Get installation options from request body
    const body = await request.json();
    const { platform, distro, includeCompose = true } = body;

    // Create temp directory for installation files
    const tempDir = path.join(os.tmpdir(), 'docker-install');
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      console.log('Temp directory already exists or creation failed');
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
      return errorResponse(
        `Unsupported platform: ${platform}`,
        'UNSUPPORTED_PLATFORM',
        400
      );
    }

    // Execute installation in background
    exec(installScript, async (error, stdout, stderr) => {
      try {
        if (error) {
          console.error(`Docker installation error: ${error.message}`);
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

        // Check if installation was successful by running docker --version
        try {
          const { stdout: versionOutput } = await execAsync('docker --version');
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
        console.error('Error writing installation logs:', fsErr);
      }
    });

    // Return immediate response
    return NextResponse.json({
      message: 'Docker installation started',
      status: 'installing',
      logFile
    });

  } catch (err) {
    console.error('Error in Docker installation API:', err);
    return errorResponse(
      'Failed to start Docker installation',
      'DOCKER_INSTALL_ERROR',
      500
    );
  }
}
