export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getAuthToken, errorResponse, validateAuthToken } from '@/utils/api';
import { isPublicMode } from '@/lib/whitelist-server';
import type {
  SystemInfo,
  SystemInfoComponentKey,
  SystemDisk,
  SystemGraphics,
  SystemNetworkInterface,
  SystemCpu
} from '@/types/systemInfo';

// Import specific modules from systeminformation
import {
  cpu,
  mem,
  graphics,
  diskLayout,
  networkInterfaces,
  osInfo
} from 'systeminformation';

const execAsync = promisify(exec);

// Max age for cache control (in seconds)
const CACHE_MAX_AGE = 5; // 5 seconds - short cache for dynamic data

// Valid component keys
const VALID_COMPONENTS: SystemInfoComponentKey[] = ['memory', 'storage', 'network', 'processes'];

/**
 * GET handler for system information API
 */
export async function GET(request: NextRequest) {
  try {
    // Check if app is in public mode using existing server-side implementation
    const publicMode = isPublicMode();

    // Skip authentication checks if in public mode
    if (!publicMode) {
      // Get token from Authorization header
      const token = getAuthToken(request);

      if (!token) {
        console.log('No token provided');
        return errorResponse('Authentication required', 'AUTH_REQUIRED', 401);
      }

      // Validate the token
      const tokenResult = await validateAuthToken(token);

      if (!tokenResult.valid) {
        console.log('Invalid token');
        return errorResponse(
          tokenResult.error || 'Invalid token',
          tokenResult.errorCode || 'INVALID_TOKEN',
          401
        );
      }

      // Admin check
      if (tokenResult.isAdmin !== true) {
        console.log('User not admin');
        return errorResponse('Admin privileges required', 'ADMIN_REQUIRED', 403);
      }
    }

    // Get the component parameter (if any)
    const url = new URL(request.url);
    const componentParam = url.searchParams.get('component');

    // Validate component parameter if provided
    if (componentParam && !VALID_COMPONENTS.includes(componentParam as SystemInfoComponentKey)) {
      return errorResponse(
        `Invalid component specified. Valid components are: ${VALID_COMPONENTS.join(', ')}`,
        'INVALID_COMPONENT',
        400
      );
    }

    const component = componentParam as SystemInfoComponentKey | null;

    // Initialize response data
    const responseData: Partial<SystemInfo> = {};

    // Check if we're requesting a specific component
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
        console.error(`Error fetching ${component} info:`, componentError);
        return errorResponse(
          `Failed to retrieve ${component} information`,
          `${component.toUpperCase()}_INFO_ERROR`,
          500,
          { message: componentError instanceof Error ? componentError.message : String(componentError) }
        );
      }

      // Set cache control headers for component data
      return createResponse(responseData);
    }

    // If no specific component requested, fetch all data
    try {
      const [
        cpuInfo,
        memoryInfo,
        graphicsInfo,
        diskLayoutInfo,
        networkInterfacesInfo,
        osInfoData
      ] = await Promise.all([
        cpu(),
        mem(),
        graphics(),
        diskLayout(),
        networkInterfaces(),
        osInfo()
      ]);

      // Format CPU cache values from numbers to strings with units
      const formattedCache: SystemCpu['cache'] = {
        l1d: cpuInfo.cache?.l1d ? formatCacheSize(cpuInfo.cache.l1d) : undefined,
        l1i: cpuInfo.cache?.l1i ? formatCacheSize(cpuInfo.cache.l1i) : undefined,
        l2: cpuInfo.cache?.l2 ? formatCacheSize(cpuInfo.cache.l2) : undefined,
        l3: cpuInfo.cache?.l3 ? formatCacheSize(cpuInfo.cache.l3) : undefined,
      };

      // Create the complete system info object
      const systemInfo: SystemInfo = {
        cpu: {
          manufacturer: cpuInfo.manufacturer,
          brand: cpuInfo.brand,
          vendor: cpuInfo.vendor || 'N/A',
          family: cpuInfo.family || 'N/A',
          model: cpuInfo.model || 'N/A',
          cores: cpuInfo.cores,
          physicalCores: cpuInfo.physicalCores,
          speed: `${cpuInfo.speed} GHz`,
          cache: formattedCache
        },
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
        pm2Processes: await getPm2Processes()
      };

      return createResponse(systemInfo);
    } catch (error) {
      console.error('Error fetching complete system information:', error);
      return errorResponse(
        'Failed to retrieve system information',
        'SYSTEM_INFO_ERROR',
        500,
        { message: error instanceof Error ? error.message : String(error) }
      );
    }
  } catch (unexpectedError) {
    console.error('Unexpected error in system API route:', unexpectedError);
    return errorResponse(
      'An unexpected error occurred',
      'UNEXPECTED_ERROR',
      500,
      { message: unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError) }
    );
  }
}

/**
 * Helper function to create response with appropriate headers
 */
function createResponse(data: any) {
  const response = NextResponse.json(data);
  response.headers.set('Cache-Control', `max-age=${CACHE_MAX_AGE}, private`);
  response.headers.set('Vary', 'Authorization');
  return response;
}

/**
 * Format memory information
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
 * Format disk information
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
 * Format graphics information
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
 * Format network information
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
 * Get PM2 process information
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
    console.log('PM2 not available or not running');
    return [];
  }
}

/**
 * Format cache size values to KB, MB or GB with appropriate units
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
 * Format uptime in a human-readable format
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
