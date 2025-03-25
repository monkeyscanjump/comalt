/**
 * System information type definitions
 */

// System information components that can be fetched individually
export type SystemInfoComponentKey = 'memory' | 'storage' | 'network' | 'processes';

// Main system information interface
export interface SystemInfo {
  memory?: SystemMemory;
  os?: SystemOs;
  cpu?: SystemCpu;
  disks?: SystemDisk[];
  network?: SystemNetworkInterface[];
  graphics?: SystemGraphics[];
  pm2Processes?: SystemProcess[];
  docker?: DockerInfo;
  uptime?: string;
}

// Docker information
export interface DockerInfo {
  installed: boolean;
  version?: string;
  path?: string;
}

// Memory information
export interface SystemMemory {
  total: string;
  free: string;
  used: string;
  percentUsed: string;
}

// Operating system information
export interface SystemOs {
  platform: string;
  distro: string;
  release: string;
  kernel: string;
  arch: string;
  hostname?: string;
}

// CPU information
export interface SystemCpu {
  manufacturer: string;
  brand: string;
  vendor: string;
  family: string;
  model: string;
  speed: string;
  cores: number;
  physicalCores: number;
  cache?: {
    l1d?: string;
    l1i?: string;
    l2?: string;
    l3?: string;
  };
}

// Storage/disk information
export interface SystemDisk {
  device: string;
  name?: string;
  type: string;
  vendor: string;
  size: string;
  model?: string;
  serial?: string;
  removable?: boolean;
  protocol?: string;
}

// Network interface information
export interface SystemNetworkInterface {
  iface: string;
  ip4: string;
  ip6: string;
  mac: string;
  type: string;
  speed: string;
  operstate: 'up' | 'down' | 'unknown';
  dhcp?: boolean;
  internal?: boolean;
}

// Graphics/GPU information
export interface SystemGraphics {
  vendor: string;
  model: string;
  vram: string;
  bus?: string;
  driverVersion?: string;
}

// Process information (PM2)
export interface SystemProcess {
  name: string;
  pid: number;
  status: 'online' | 'stopping' | 'stopped' | 'errored' | 'unknown';
  cpu: string;
  memory: string;
  uptime: string;
  restarts?: number;
  createdAt?: string;
}

// Component to property mapping
export interface ComponentToPropertyMap {
  [key: string]: keyof SystemInfo;
}
