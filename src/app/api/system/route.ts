export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { withApiRoute } from '@/middlewares/withApiRoute';
import path from 'path';
import fs from 'fs';
import * as fsPromises from 'fs/promises';
import type {
  SystemInfo,
  SystemInfoComponentKey,
  SystemDisk,
  SystemGraphics,
  SystemNetworkInterface,
  SystemCpu,
  DockerInfo
} from '@/types/systemInfo';

import {
  cpu,
  mem,
  graphics,
  diskLayout,
  networkInterfaces,
  osInfo
} from 'systeminformation';

const execAsync = promisify(exec);

const VALID_COMPONENTS: SystemInfoComponentKey[] = ['memory', 'storage', 'network', 'processes', 'docker'];

/**
 * Check Docker installation status and progress
 */
async function checkDockerStatus(wantProgress = false): Promise<DockerInfo | any> {
  if (wantProgress) {
    try {
      const statusFile = path.join(os.tmpdir(), 'docker-install-status.json');
      if (!fs.existsSync(statusFile)) {
        return { status: 'unknown' };
      }

      const status = JSON.parse(await fsPromises.readFile(statusFile, 'utf-8'));

      if (status.status === 'completed' && status.version) {
        return {
          status: 'completed',
          version: status.version,
          installed: true
        };
      }

      if (status.log) {
        return {
          status: status.status,
          log: status.log
        };
      }

      if (status.error) {
        return {
          status: 'error',
          error: status.error
        };
      }

      return status;
    } catch (err) {
      return { status: 'unknown' };
    }
  }

  try {
    const { stdout } = await execAsync('docker --version', {
      timeout: 5000,
      env: { ...process.env, PATH: process.env.PATH }
    });

    return {
      installed: true,
      version: stdout.trim()
    };
  } catch (primaryErr) {
    if (process.platform === 'win32') {
      try {
        const possiblePaths = [
          'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
          'C:\\Program Files\\Docker\\Docker\\Docker for Windows.exe',
          'C:\\ProgramData\\DockerDesktop\\version-bin\\docker.exe'
        ];

        for (const dockerPath of possiblePaths) {
          if (fs.existsSync(dockerPath)) {
            const { stdout } = await execAsync(`"${dockerPath}" --version`, {
              timeout: 5000
            });

            return {
              installed: true,
              version: stdout.trim(),
              path: dockerPath
            };
          }
        }

        throw new Error('Docker executable not found in expected locations');
      } catch (windowsErr) {
        // Silent fail, continue to next checks
      }
    } else {
      try {
        if (process.platform === 'linux') {
          const { stdout: serviceOutput } = await execAsync('systemctl is-active docker', { timeout: 3000 });
          if (serviceOutput.trim() === 'active') {
            return {
              installed: true,
              version: 'Service active (version check failed)',
              note: 'Docker service is running but version check failed'
            };
          }
        } else if (process.platform === 'darwin') {
          const { stdout: appOutput } = await execAsync('ls -la /Applications/Docker.app', { timeout: 3000 });
          if (appOutput) {
            return {
              installed: true,
              version: 'App installed (version check failed)',
              note: 'Docker app is installed but version check failed'
            };
          }
        }
      } catch (serviceErr) {
        // Silent fail, continue
      }
    }

    return {
      installed: false,
      error: primaryErr instanceof Error ? primaryErr.message : 'Failed to execute Docker command'
    };
  }
}

/**
 * Main handler for system information API
 */
const handleSystemRequest = async (request: NextRequest) => {
  const startTime = Date.now();
  const url = new URL(request.url);
  const componentParam = url.searchParams.get('component');
  const wantProgress = url.searchParams.get('progress') === 'true';

  if (componentParam && !VALID_COMPONENTS.includes(componentParam as SystemInfoComponentKey)) {
    const error = new Error(`Invalid component specified. Valid components are: ${VALID_COMPONENTS.join(', ')}`);
    (error as any).code = 'INVALID_COMPONENT';
    (error as any).status = 400;
    throw error;
  }

  const component = componentParam as SystemInfoComponentKey | null;

  if (component === 'docker') {
    try {
      const dockerInfo = await checkDockerStatus(wantProgress);
      return createResponse(dockerInfo);
    } catch (dockerErr) {
      const error = new Error('Failed to check Docker status');
      (error as any).code = 'DOCKER_CHECK_ERROR';
      (error as any).status = 500;
      throw error;
    }
  }

  const responseData: Partial<SystemInfo> = {};

  if (component) {
    try {
      switch (component) {
        case 'memory': {
          const memoryInfo = await mem();
          responseData.memory = formatMemory(memoryInfo);
          break;
        }

        case 'storage': {
          const diskLayoutInfo = await diskLayout();
          responseData.disks = formatDisks(diskLayoutInfo);
          break;
        }

        case 'network': {
          const networkInterfacesInfo = await networkInterfaces();
          responseData.network = formatNetwork(networkInterfacesInfo);
          break;
        }

        case 'processes': {
          responseData.pm2Processes = await getPm2Processes();
          break;
        }
      }
    } catch (componentError) {
      const error = new Error(`Failed to retrieve ${component} information`);
      (error as any).code = `${component.toUpperCase()}_INFO_ERROR`;
      (error as any).status = 500;
      (error as any).details = {
        message: componentError instanceof Error ? componentError.message : String(componentError)
      };
      throw error;
    }

    return createResponse(responseData);
  }

  try {
    const [
      cpuInfo,
      memoryInfo,
      graphicsInfo,
      diskLayoutInfo,
      networkInterfacesInfo,
      osInfoData,
      dockerInfo
    ] = await Promise.all([
      cpu(),
      mem(),
      graphics(),
      diskLayout(),
      networkInterfaces(),
      osInfo(),
      checkDockerStatus(false)
    ]);

    // Format CPU cache values
    const formattedCache: SystemCpu['cache'] = {
      l1d: cpuInfo.cache?.l1d ? formatCacheSize(cpuInfo.cache.l1d) : undefined,
      l1i: cpuInfo.cache?.l1i ? formatCacheSize(cpuInfo.cache.l1i) : undefined,
      l2: cpuInfo.cache?.l2 ? formatCacheSize(cpuInfo.cache.l2) : undefined,
      l3: cpuInfo.cache?.l3 ? formatCacheSize(cpuInfo.cache.l3) : undefined,
    };

    // Handle multi-CPU systems and create appropriate CPU data structure
    let cpuData: SystemCpu | SystemCpu[];

    const physicalCpuCount = typeof cpuInfo.socket === 'number'
      ? cpuInfo.socket
      : (parseInt(String(cpuInfo.socket)) || 1);

    if (physicalCpuCount > 1) {
      // Create an array of CPU objects for multi-CPU systems
      cpuData = [];
      for (let i = 0; i < physicalCpuCount; i++) {
        const cores = typeof cpuInfo.cores === 'number'
          ? cpuInfo.cores
          : (parseInt(String(cpuInfo.cores)) || 1);

        const physicalCores = typeof cpuInfo.physicalCores === 'number'
          ? cpuInfo.physicalCores
          : (parseInt(String(cpuInfo.physicalCores)) || 1);

        // Fix 3: Ensure speed is a string
        const speedStr = typeof cpuInfo.speed === 'number'
          ? `${cpuInfo.speed} GHz`
          : (cpuInfo.speed || 'Unknown');

        cpuData.push({
          manufacturer: cpuInfo.manufacturer,
          brand: `${cpuInfo.brand} (Socket ${i+1})`,
          vendor: cpuInfo.vendor || 'N/A',
          family: cpuInfo.family || 'N/A',
          model: cpuInfo.model || 'N/A',
          // Use the fixed numeric values for calculations
          cores: Math.floor(cores / physicalCpuCount),
          physicalCores: Math.floor(physicalCores / physicalCpuCount),
          speed: speedStr,
          cache: formattedCache,
          socket: i + 1
        });
      }
    } else {
      // Single CPU system (the most common case)
      // Fix 4: Ensure cores and physicalCores are numbers
      const cores = typeof cpuInfo.cores === 'number'
        ? cpuInfo.cores
        : (parseInt(String(cpuInfo.cores)) || 1);

      const physicalCores = typeof cpuInfo.physicalCores === 'number'
        ? cpuInfo.physicalCores
        : (parseInt(String(cpuInfo.physicalCores)) || 1);

      // Fix 5: Ensure speed is a string
      const speedStr = typeof cpuInfo.speed === 'number'
        ? `${cpuInfo.speed} GHz`
        : (cpuInfo.speed || 'Unknown');

      cpuData = {
        manufacturer: cpuInfo.manufacturer,
        brand: cpuInfo.brand,
        vendor: cpuInfo.vendor || 'N/A',
        family: cpuInfo.family || 'N/A',
        model: cpuInfo.model || 'N/A',
        cores: cores,
        physicalCores: physicalCores,
        speed: speedStr,
        cache: formattedCache,
        socket: 1
      };
    }

    // Create the complete system info object
    const systemInfo: SystemInfo = {
      cpu: cpuData, // Now this can be either a single CPU or an array
      memory: formatMemory(memoryInfo),
      graphics: formatGraphics(graphicsInfo),
      disks: formatDisks(diskLayoutInfo),
      network: formatNetwork(networkInterfacesInfo),
      os: {
        platform: osInfoData.platform,
        distro: osInfoData.distro,
        release: osInfoData.release,
        kernel: osInfoData.kernel,
        arch: osInfoData.arch,
        hostname: osInfoData.hostname
      },
      uptime: formatUptime(os.uptime()),
      pm2Processes: await getPm2Processes(),
      docker: dockerInfo
    };

    return createResponse(systemInfo);
  } catch (error) {
    const apiError = new Error('Failed to retrieve system information');
    (apiError as any).code = 'SYSTEM_INFO_ERROR';
    (apiError as any).status = 500;
    (apiError as any).details = {
      message: error instanceof Error ? error.message : String(error)
    };
    throw apiError;
  }
};

/**
 * Export the GET handler with authentication middleware
 */
export const GET = withApiRoute(handleSystemRequest, {
  requireAuth: true,
  requireAdmin: true
});

/**
 * Helper function to create response with appropriate headers
 */
function createResponse(data: any) {
  const response = NextResponse.json({
    ...data,
    _timestamp: Date.now()
  });

  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Vary', 'Authorization');

  return response;
}

/**
 * Format memory info to user-friendly values
 */
function formatMemory(memoryInfo: any) {
  return {
    total: (memoryInfo.total / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
    free: (memoryInfo.free / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
    used: (memoryInfo.used / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
    percentUsed: ((memoryInfo.used / memoryInfo.total) * 100).toFixed(2) + '%'
  };
}

/**
 * Format disk info to user-friendly values
 */
function formatDisks(diskLayoutInfo: any[]): SystemDisk[] {
  return diskLayoutInfo.map(disk => ({
    device: disk.device,
    type: disk.type,
    name: disk.name,
    size: (disk.size / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
    vendor: disk.vendor || 'N/A',
    model: disk.model || 'N/A',
    serial: disk.serial || 'N/A',
    removable: disk.removable || false,
    protocol: disk.protocol || 'N/A'
  }));
}

/**
 * Format graphics info to user-friendly values
 */
function formatGraphics(graphicsInfo: { controllers: any[] }): SystemGraphics[] {
  return graphicsInfo.controllers.map(gpu => ({
    vendor: gpu.vendor || 'N/A',
    model: gpu.model || 'N/A',
    vram: gpu.vram ? (gpu.vram / 1024).toFixed(2) + ' GB' : 'N/A',
    bus: gpu.bus || 'N/A',
    driverVersion: gpu.driverVersion || 'N/A'
  }));
}

/**
 * Format network info to user-friendly values
 */
function formatNetwork(networkInterfacesInfo: any): SystemNetworkInterface[] {
  const networkArray = Array.isArray(networkInterfacesInfo)
    ? networkInterfacesInfo
    : [networkInterfacesInfo];

  return networkArray
    .filter(iface => iface.ifaceName !== 'lo' && iface.ifaceName !== 'localhost')
    .map(iface => ({
      iface: iface.ifaceName || 'unknown',
      ip4: iface.ip4 || 'N/A',
      ip6: iface.ip6 || 'N/A',
      mac: iface.mac || 'N/A',
      type: iface.type || 'N/A',
      speed: iface.speed ? (iface.speed + ' Mbps') : 'N/A',
      operstate: (iface.operstate as 'up' | 'down' | 'unknown') || 'unknown',
      dhcp: iface.dhcp,
      internal: iface.internal
    }));
}

/**
 * Get PM2 process information if available
 */
async function getPm2Processes() {
  try {
    const { stdout } = await execAsync('pm2 jlist');
    const pm2Processes = JSON.parse(stdout);

    return pm2Processes.map((process: any) => ({
      name: process.name,
      pid: process.pid,
      status: (process.pm2_env?.status || 'unknown') as 'online' | 'stopping' | 'stopped' | 'errored' | 'unknown',
      cpu: process.monit?.cpu + '%',
      memory: (process.monit?.memory / (1024 * 1024)).toFixed(2) + ' MB',
      uptime: formatUptime(process.pm2_env?.pm_uptime ?
        (Date.now() - process.pm2_env.pm_uptime) / 1000 : 0),
      restarts: process.pm2_env?.restart_time ?? 0,
      createdAt: process.pm2_env?.created_at ? new Date(process.pm2_env.created_at).toISOString() : undefined
    }));
  } catch (error) {
    return [];
  }
}

/**
 * Format cache size to user-friendly values
 */
function formatCacheSize(sizeInKB: number): string {
  if (!sizeInKB) return 'N/A';

  if (sizeInKB < 1024) {
    return `${sizeInKB} KB`;
  } else if (sizeInKB < 1024 * 1024) {
    return `${(sizeInKB / 1024).toFixed(2)} MB`;
  } else {
    return `${(sizeInKB / (1024 * 1024)).toFixed(2)} GB`;
  }
}

/**
 * Format uptime to user-friendly values
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  let uptime = '';
  if (days > 0) uptime += `${days}d `;
  if (hours > 0) uptime += `${hours}h `;
  uptime += `${minutes}m`;

  return uptime;
}
