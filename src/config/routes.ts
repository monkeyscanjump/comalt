import { IconType } from 'react-icons';

// Page metadata types
export interface RouteInfo {
  path: string;
  title: string;
  icon: IconType;
  order: number;
  showInNav: boolean;
}

/**
 * This file only defines types now.
 * The actual page discovery happens in utils/pageDiscovery.ts
 */

export function getRoutes(): RouteInfo[] {
  // This function is kept for backward compatibility
  // but actual implementation is moved to utils/pageDiscovery.ts
  return [];
}
