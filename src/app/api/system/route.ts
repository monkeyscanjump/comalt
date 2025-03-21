export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getAuthToken, errorResponse, validateAuthToken } from '@/utils/api';
import { isPublicMode } from '@/lib/whitelist-server';
import type { SystemInfo, SystemInfoComponentKey, ComponentToPropertyMap } from '@/types/systemInfo';

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
    const component = url.searchParams.get('component');

    // Initialize response data
    const responseData: Partial<SystemInfo> = {};

    // Check if we're requesting a specific component
    if (component) {
      switch (component) {
        case 'memory': {
          const memoryInfo = await mem();
          responseData.memory = {
            total: (memoryInfo.total / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
            free: (memoryInfo.free / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
            used: (memoryInfo.used / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
            percentUsed: ((memoryInfo.used / memoryInfo.total) * 100).toFixed(2) + '%'
          };
          break;
        }

        case 'storage': {
          const diskLayoutInfo = await diskLayout();
          responseData.disks = diskLayoutInfo.map(disk => ({
            device: disk.device,
            type: disk.type,
            name: disk.name,
            size: (disk.size / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
            vendor: disk.vendor
          }));
          break;
        }

        case 'network': {
          const networkInterfacesInfo = await networkInterfaces();
          const networkArray = Array.isArray(networkInterfacesInfo)
            ? networkInterfacesInfo
            : [networkInterfacesInfo];

          responseData.network = networkArray
            .filter(iface => iface.ifaceName !== 'lo' && iface.ifaceName !== 'localhost')
            .map(iface => ({
              iface: iface.ifaceName,
              ip4: iface.ip4 || 'N/A',
              ip6: iface.ip6 || 'N/A',
              mac: iface.mac || 'N/A',
              type: iface.type || 'N/A',
              speed: iface.speed ? (iface.speed + ' Mbps') : 'N/A',
              operstate: iface.operstate || 'N/A'
            }));
          break;
        }

        case 'processes': {
          // Get PM2 processes if available
          let pm2Processes = [];
          try {
            const { stdout } = await execAsync('pm2 jlist');
            pm2Processes = JSON.parse(stdout);

            responseData.pm2Processes = pm2Processes.map((process: any) => ({
              name: process.name,
              pid: process.pid,
              status: process.pm2_env?.status,
              cpu: process.monit?.cpu + '%',
              memory: (process.monit?.memory / (1024 * 1024)).toFixed(2) + ' MB',
              uptime: formatUptime(process.pm2_env?.pm_uptime ?
                (Date.now() - process.pm2_env.pm_uptime) / 1000 : 0)
            }));
          } catch (error) {
            console.log('PM2 not available or not running');
            responseData.pm2Processes = [];
          }
          break;
        }

        default:
          return errorResponse('Invalid component specified', 'INVALID_COMPONENT', 400);
      }

      return NextResponse.json(responseData);
    }

    // If no specific component requested, fetch all data as before
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

    // Format memory values
    const formattedMemory = {
      total: (memoryInfo.total / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
      free: (memoryInfo.free / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
      used: (memoryInfo.used / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
      percentUsed: ((memoryInfo.used / memoryInfo.total) * 100).toFixed(2) + '%'
    };

    // Format disk information
    const formattedDisks = diskLayoutInfo.map(disk => ({
      device: disk.device,
      type: disk.type,
      name: disk.name,
      size: (disk.size / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
      vendor: disk.vendor
    }));

    // Format GPU information
    const formattedGraphics = graphicsInfo.controllers.map(gpu => ({
      vendor: gpu.vendor,
      model: gpu.model,
      vram: gpu.vram ? (gpu.vram / 1024).toFixed(2) + ' GB' : 'N/A',
      driverVersion: gpu.driverVersion || 'N/A'
    }));

    // Format network information
    const networkArray = Array.isArray(networkInterfacesInfo)
      ? networkInterfacesInfo
      : [networkInterfacesInfo];

    const formattedNetwork = networkArray
      .filter(iface => iface.ifaceName !== 'lo' && iface.ifaceName !== 'localhost')
      .map(iface => ({
        iface: iface.ifaceName,
        ip4: iface.ip4 || 'N/A',
        ip6: iface.ip6 || 'N/A',
        mac: iface.mac || 'N/A',
        type: iface.type || 'N/A',
        speed: iface.speed ? (iface.speed + ' Mbps') : 'N/A',
        operstate: iface.operstate || 'N/A'
      }));

    // Get PM2 processes if available
    let pm2Processes = [];
    try {
      const { stdout } = await execAsync('pm2 jlist');
      pm2Processes = JSON.parse(stdout);
    } catch (error) {
      console.log('PM2 not available or not running');
    }

    // Create the response object
    const systemInfo: SystemInfo = {
      cpu: {
        manufacturer: cpuInfo.manufacturer,
        brand: cpuInfo.brand,
        cores: cpuInfo.cores,
        physicalCores: cpuInfo.physicalCores,
        speed: cpuInfo.speed + ' GHz'
      },
      memory: formattedMemory,
      graphics: formattedGraphics,
      disks: formattedDisks,
      network: formattedNetwork,
      os: {
        platform: osInfoData.platform,
        distro: osInfoData.distro,
        release: osInfoData.release,
        kernel: osInfoData.kernel,
        arch: osInfoData.arch
      },
      uptime: formatUptime(os.uptime()),
      pm2Processes: pm2Processes.map((process: any) => ({
        name: process.name,
        pid: process.pid,
        status: process.pm2_env?.status,
        cpu: process.monit?.cpu + '%',
        memory: (process.monit?.memory / (1024 * 1024)).toFixed(2) + ' MB',
        uptime: formatUptime(process.pm2_env?.pm_uptime ?
          (Date.now() - process.pm2_env.pm_uptime) / 1000 : 0)
      }))
    };

    return NextResponse.json(systemInfo);
  } catch (error) {
    console.error('Error fetching system information:', error);
    return errorResponse(
      'Failed to retrieve system information',
      'SYSTEM_INFO_ERROR',
      500,
      { message: error instanceof Error ? error.message : String(error) }
    );
  }
}

// Helper function to format uptime
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
