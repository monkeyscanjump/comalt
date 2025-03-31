import { IconType } from 'react-icons';
import { FaHome, FaCog, FaUser, FaInfoCircle, FaFileAlt, FaDesktop } from 'react-icons/fa';
import { FiPackage, FiHardDrive } from 'react-icons/fi';

// Map of page paths to their metadata
const PAGE_REGISTRY: Record<string, {
  title: string;
  icon: IconType;
  order: number;
  showInNav: boolean;
}> = {
  // Core pages
  '/': {
    title: 'Dashboard',
    icon: FaHome,
    order: 1,
    showInNav: true
  },
  '/packages': {
    title: 'Packages',
    icon: FiPackage,
    order: 2,
    showInNav: true
  },
  '/devices': {
    title: 'Devices',
    icon: FaDesktop,
    order: 3,
    showInNav: true
  },
  '/drive': {
    title: 'Drive',
    icon: FiHardDrive,
    order: 4,
    showInNav: true
  },
  // Add more pages here - they'll automatically appear in navigation
};

// This function discovers all pages based on the app's folder structure
export function discoverPages() {
  const pages = [];

  // Get all page directories in the app folder
  // For now, we're using the hardcoded PAGE_REGISTRY
  // but this can be enhanced with a build-time script later

  for (const [path, metadata] of Object.entries(PAGE_REGISTRY)) {
    pages.push({
      path,
      title: metadata.title,
      icon: metadata.icon,
      order: metadata.order,
      showInNav: metadata.showInNav
    });
  }

  // Look for dynamically added pages in Next.js app folder
  // In a real implementation, this would be generated at build time

  // Sort pages by order
  return pages.sort((a, b) => a.order - b.order);
}

// Map paths to icons
export function getIconForPath(path: string): IconType {
  // Strip trailing slash for consistency
  const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;

  // Check if we have a predefined icon
  if (normalizedPath in PAGE_REGISTRY) {
    return PAGE_REGISTRY[normalizedPath].icon;
  }

  // Fallback icons based on path patterns
  if (normalizedPath === '/') return FaHome;
  if (normalizedPath.includes('packages')) return FiPackage;
  if (normalizedPath.includes('settings')) return FaCog;
  if (normalizedPath.includes('devices')) return FaDesktop;
  if (normalizedPath.includes('devices')) return FiHardDrive;
  if (normalizedPath.includes('user') || normalizedPath.includes('account')) return FaUser;
  if (normalizedPath.includes('about')) return FaInfoCircle;

  // Default icon
  return FaFileAlt;
}
