export type SystemInfoComponentKey = 'memory' | 'storage' | 'network' | 'processes';

export interface ComponentToPropertyMap {
  memory: 'memory';
  storage: 'disks';
  network: 'network';
  processes: 'pm2Processes';
}

export interface SystemInfo {
  cpu: {
    manufacturer: string;
    brand: string;
    cores: number;
    physicalCores: number;
    speed: string;
  };
  memory: {
    total: string;
    free: string;
    used: string;
    percentUsed: string;
  };
  graphics: Array<{
    vendor: string;
    model: string;
    vram?: string;
    driverVersion?: string;
  }>;
  disks: Array<{
    device: string;
    type: string;
    name: string;
    size: string;
    vendor: string;
  }>;
  network: Array<{
    iface: string;
    ip4: string;
    ip6: string;
    mac: string;
    type: string;
    speed: string;
    operstate: string;
  }>;
  os: {
    platform: string;
    distro: string;
    release: string;
    kernel: string;
    arch: string;
  };
  uptime: string;
  pm2Processes?: Array<{
    name: string;
    pid: number;
    status: string;
    cpu: string;
    memory: string;
    uptime: string;
  }>;
}
