import type { SystemInfo } from '@/types/systemInfo';

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

  // Ensure CPU speed has units
  if (result.cpu?.speed && typeof result.cpu.speed === 'string' && !result.cpu.speed.includes('GHz')) {
    result.cpu.speed = `${result.cpu.speed} GHz`;
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
