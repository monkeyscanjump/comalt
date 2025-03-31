import type { SystemInfo, SystemCpu } from '@/types/systemInfo';

/**
 * Applies consistent formatting to system data
 * This ensures any data from API or localStorage has consistent structure
 */
export function transformSystemData(data: any): SystemInfo {
  if (!data) return {} as SystemInfo;

  const result = { ...data } as SystemInfo;

  // Ensure memory data is properly formatted
  if (result.memory) {
    result.memory = {
      total: ensureUnit(result.memory.total, 'GB'),
      free: ensureUnit(result.memory.free, 'GB'),
      used: ensureUnit(result.memory.used, 'GB'),
      percentUsed: ensurePercentage(result.memory.percentUsed)
    };
  }

  // Handle CPU data - now supporting both single CPU and array of CPUs
  if (result.cpu) {
    if (Array.isArray(result.cpu)) {
      // Handle array of CPUs
      result.cpu = result.cpu.map(processCpuData);
    } else {
      // Handle single CPU object
      result.cpu = processCpuData(result.cpu);
    }
  }

  // Ensure disks have consistent formatting
  if (result.disks && Array.isArray(result.disks)) {
    result.disks = result.disks.map(disk => ({
      ...disk,
      size: ensureUnit(disk.size, 'GB')
    }));
  }

  // Ensure processes have consistent formatting
  if (result.pm2Processes && Array.isArray(result.pm2Processes)) {
    result.pm2Processes = result.pm2Processes.map(process => ({
      ...process,
      cpu: ensurePercentage(process.cpu),
      memory: ensureUnit(process.memory, 'MB')
    }));
  }

  // Ensure graphics cards have consistent VRAM formatting
  if (result.graphics && Array.isArray(result.graphics)) {
    result.graphics = result.graphics.map(gpu => ({
      ...gpu,
      vram: gpu.vram ? ensureUnit(gpu.vram, 'GB') : 'N/A'
    }));
  }

  // Ensure network interfaces have consistent speed formatting
  if (result.network && Array.isArray(result.network)) {
    result.network = result.network.map(iface => ({
      ...iface,
      speed: iface.speed ? ensureUnit(iface.speed, 'Mbps') : 'N/A'
    }));
  }

  return result;
}

/**
 * Helper function to process CPU data and ensure proper typing
 */
function processCpuData(cpu: any): SystemCpu {
  if (!cpu) return {} as SystemCpu;

  // Create a new object with properly typed values
  return {
    manufacturer: cpu.manufacturer || 'Unknown',
    brand: cpu.brand || 'Unknown',
    vendor: cpu.vendor || 'N/A',
    family: cpu.family || 'N/A',
    model: cpu.model || 'N/A',
    // Ensure cores and physicalCores are numbers
    cores: typeof cpu.cores === 'number' ? cpu.cores : (parseInt(String(cpu.cores || '0')) || 0),
    physicalCores: typeof cpu.physicalCores === 'number' ? cpu.physicalCores :
                  (parseInt(String(cpu.physicalCores || '0')) || 0),
    // Ensure speed has GHz units if it's a number or doesn't already include it
    speed: typeof cpu.speed === 'number' ?
           `${cpu.speed} GHz` :
           (typeof cpu.speed === 'string' && !cpu.speed.includes('GHz') ?
            `${cpu.speed} GHz` : (cpu.speed || 'Unknown')),
    // Include the cache if it exists
    cache: cpu.cache ? {
      l1d: cpu.cache.l1d || undefined,
      l1i: cpu.cache.l1i || undefined,
      l2: cpu.cache.l2 || undefined,
      l3: cpu.cache.l3 || undefined,
    } : undefined,
    // Include socket if it exists
    socket: typeof cpu.socket === 'number' ? cpu.socket :
           (parseInt(String(cpu.socket || '1')) || 1)
  };
}

/**
 * Ensures a value has the specified unit suffix
 */
function ensureUnit(value: string | number, unit: string): string {
  if (typeof value === 'number') {
    return `${value} ${unit}`;
  }

  if (typeof value === 'string') {
    if (value.includes(unit)) {
      return value;
    }
    return `${value} ${unit}`;
  }

  return `0 ${unit}`;
}

/**
 * Ensures a value is formatted as a percentage
 */
function ensurePercentage(value: string | number): string {
  if (typeof value === 'number') {
    return `${value}%`;
  }

  if (typeof value === 'string') {
    if (value.includes('%')) {
      return value;
    }
    return `${value}%`;
  }

  return '0%';
}

/**
 * Formats bytes into human-readable sizes with appropriate units
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Formats a timestamp in seconds to a human-readable duration (days, hours, minutes)
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  let uptime = '';
  if (days > 0) uptime += `${days}d `;
  if (hours > 0) uptime += `${hours}h `;
  uptime += `${minutes}m`;

  return uptime;
}
