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
  SystemCpu,
  DockerInfo  // Import DockerInfo type
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
const CACHE_MAX_AGE = 0; // Disable caching completely - was 5 seconds

// Valid component keys
const VALID_COMPONENTS: SystemInfoComponentKey[] = ['memory', 'storage', 'network', 'processes'];

/**
 * Check Docker installation status
 */
async function checkDockerStatus(): Promise<DockerInfo> {
  console.log('[System API] Checking Docker installation status');

  try {
    // Use the existing Docker status API directly
    // This leverages the robust Docker detection already implemented
    console.log('[System API] Calling internal Docker status API');

    // Create a server-side fetch to the Docker status API
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = process.env.HOSTNAME || 'localhost';
    const port = process.env.PORT || '3000';
    const baseUrl = `${protocol}://${host}:${port}`;

    // Make the request to the internal Docker status API
    const dockerStatusUrl = `${baseUrl}/api/docker/status`;
    console.log(`[System API] Fetching from internal API: ${dockerStatusUrl}`);

    // Use native fetch in a server component
    const response = await fetch(dockerStatusUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Internal-Request': 'true' // Add a header to identify internal requests
      },
      next: { revalidate: 0 } // Ensure fresh data
    });

    if (!response.ok) {
      console.error(`[System API] Docker status API responded with status: ${response.status}`);
      return { installed: false };
    }

    const data = await response.json();
    console.log('[System API] Docker status API response:', data);

    return {
      installed: data.installed || false,
      version: data.version || undefined,
      path: data.path || undefined
    };
  } catch (error) {
    console.error('[System API] Error fetching Docker status:', error);

    // Fallback implementation if internal API call fails
    try {
      // Try direct command for Docker version
      const { stdout } = await execAsync('docker --version', { timeout: 3000 });
      const versionMatch = stdout.match(/Docker version ([0-9.]+)/);
      const version = versionMatch ? versionMatch[1] : 'Unknown';

      return {
        installed: true,
        version
      };
    } catch (fallbackError) {
      console.log('[System API] Fallback Docker check also failed:', fallbackError);
      return { installed: false };
    }
  }
}

/**
 * GET handler for system information API
 */
export async function GET(request: NextRequest) {
  console.log('[System API] Request received:', request.url);
  const startTime = Date.now();

  try {
    // Check if app is in public mode using existing server-side implementation
    const publicMode = isPublicMode();
    console.log('[System API] Public mode:', publicMode);

    // Skip authentication checks if in public mode
    if (!publicMode) {
      // Get token from Authorization header
      const token = getAuthToken(request);

      if (!token) {
        console.log('[System API] No token provided');
        return errorResponse('Authentication required', 'AUTH_REQUIRED', 401);
      }

      // Validate the token
      const tokenResult = await validateAuthToken(token);

      if (!tokenResult.valid) {
        console.log('[System API] Invalid token:', tokenResult.error);
        return errorResponse(
          tokenResult.error || 'Invalid token',
          tokenResult.errorCode || 'INVALID_TOKEN',
          401
        );
      }

      // Admin check
      if (tokenResult.isAdmin !== true) {
        console.log('[System API] User not admin');
        return errorResponse('Admin privileges required', 'ADMIN_REQUIRED', 403);
      }

      console.log('[System API] Authentication successful');
    }

    // Get the component parameter (if any)
    const url = new URL(request.url);
    const componentParam = url.searchParams.get('component');

    console.log('[System API] Component parameter:', componentParam || 'none');

    // Validate component parameter if provided
    if (componentParam && !VALID_COMPONENTS.includes(componentParam as SystemInfoComponentKey)) {
      console.log('[System API] Invalid component:', componentParam);
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
      console.log(`[System API] Fetching specific component: ${component}`);
      try {
        switch (component) {
          case 'memory': {
            console.log('[System API] Retrieving memory info');
            const memoryInfo = await mem();
            responseData.memory = formatMemory(memoryInfo);
            break;
          }

          case 'storage': {
            console.log('[System API] Retrieving disk info');
            const diskLayoutInfo = await diskLayout();
            responseData.disks = formatDisks(diskLayoutInfo);
            break;
          }

          case 'network': {
            console.log('[System API] Retrieving network info');
            const networkInterfacesInfo = await networkInterfaces();
            responseData.network = formatNetwork(networkInterfacesInfo);
            break;
          }

          case 'processes': {
            console.log('[System API] Retrieving PM2 processes');
            responseData.pm2Processes = await getPm2Processes();
            break;
          }
        }
      } catch (componentError) {
        console.error(`[System API] Error fetching ${component} info:`, componentError);
        return errorResponse(
          `Failed to retrieve ${component} information`,
          `${component.toUpperCase()}_INFO_ERROR`,
          500,
          { message: componentError instanceof Error ? componentError.message : String(componentError) }
        );
      }

      console.log(`[System API] Component ${component} retrieved successfully`);
      // Set cache control headers for component data
      return createResponse(responseData);
    }

    // If no specific component requested, fetch all data
    console.log('[System API] Fetching complete system information');
    try {
      // Run all data fetching promises in parallel
      const [
        cpuInfo,
        memoryInfo,
        graphicsInfo,
        diskLayoutInfo,
        networkInterfacesInfo,
        osInfoData,
        dockerInfo  // Add Docker info check
      ] = await Promise.all([
        cpu(),
        mem(),
        graphics(),
        diskLayout(),
        networkInterfaces(),
        osInfo(),
        checkDockerStatus()  // Get Docker status
      ]);

      console.log('[System API] All system data collected');
      console.log('[System API] Docker status:', dockerInfo.installed ? 'Installed' : 'Not installed');

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
        pm2Processes: await getPm2Processes(),
        docker: dockerInfo  // Add Docker info to the response
      };

      console.log('[System API] System info prepared successfully');
      const elapsedTime = Date.now() - startTime;
      console.log(`[System API] Request completed in ${elapsedTime}ms`);

      return createResponse(systemInfo);
    } catch (error) {
      console.error('[System API] Error fetching complete system information:', error);
      return errorResponse(
        'Failed to retrieve system information',
        'SYSTEM_INFO_ERROR',
        500,
        { message: error instanceof Error ? error.message : String(error) }
      );
    }
  } catch (unexpectedError) {
    console.error('[System API] Unexpected error in system API route:', unexpectedError);
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
  const response = NextResponse.json({
    ...data,
    _timestamp: Date.now() // Add timestamp to prevent caching
  });

  // Completely disable caching
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
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
    console.log('[System API] PM2 not available or not running');
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
