export interface PackageRequirements {
  [key: string]: string;
}

export interface Package {
  id: string;
  name: string;
  description?: string;
  githubUrl: string;
  category: string;
  tags?: string[];
  // Handle both string array and JSON string
  installCommands: string[] | string;
  startCommand?: string;
  requirements?: PackageRequirements;
  defaultInstallPath?: string;

  // Fields from database
  isInstalled?: boolean;
  installedVersion?: string | null;
  installPath?: string | null;
  installedAt?: string | null;
  lastCheckedAt?: string | null;
  lastError?: string | null;
}

// Helper function to get commands as array
export function getCommandsAsArray(commands: string[] | string): string[] {
  if (Array.isArray(commands)) {
    return commands;
  }

  if (typeof commands === 'string') {
    try {
      const parsed = JSON.parse(commands);
      return Array.isArray(parsed) ? parsed : [commands];
    } catch (e) {
      return [commands];
    }
  }

  return [];
}
