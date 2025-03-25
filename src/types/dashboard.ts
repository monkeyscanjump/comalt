import { SectionId } from '@/hooks/useCollapsibleSections';

/**
 * Dashboard-specific type definitions
 */

// Available display modes for the dashboard
export type DisplayMode = 'default' | 'compact' | 'detailed';

// Dashboard preferences saved in localStorage
export interface DashboardPreferences {
  displayMode: DisplayMode;
  autoRefreshEnabled: boolean;
  autoRefreshInterval: number; // in seconds
  visibleSections: Record<SectionId, boolean>;
}

// Props for section components
export interface BaseSectionProps {
  isRefreshing?: boolean;
  isCollapsed?: boolean;
  onRefresh?: () => void;
  onToggleCollapse?: () => void;
  displayMode?: DisplayMode;
  className?: string;
}

// Error information for error displays
export interface ErrorInfo {
  message: string;
  code?: string;
  retry?: boolean;
}

// Dashboard settings panel props
export interface DashboardSettingsProps {
  preferences: DashboardPreferences;
  onUpdatePreference: <K extends keyof DashboardPreferences>(
    key: K,
    value: DashboardPreferences[K]
  ) => void;
  onClose: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}

// Auto-refresh options for dropdown
export interface RefreshOption {
  label: string;
  value: number; // seconds
}

export const REFRESH_OPTIONS: RefreshOption[] = [
  { label: 'Disabled', value: 0 },
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '10 minutes', value: 600 },
  { label: '30 minutes', value: 1800 }
];

// Section display configuration
export interface SectionDisplayConfig {
  id: SectionId;
  label: string;
  canRefresh: boolean;
  isFullWidth: boolean;
}

export const SECTION_CONFIG: SectionDisplayConfig[] = [
  { id: 'memory', label: 'Memory', canRefresh: true, isFullWidth: false },
  { id: 'os', label: 'Operating System', canRefresh: false, isFullWidth: false },
  { id: 'cpu', label: 'CPU', canRefresh: false, isFullWidth: true },
  { id: 'gpu', label: 'Graphics', canRefresh: false, isFullWidth: true },
  { id: 'storage', label: 'Storage', canRefresh: true, isFullWidth: true },
  { id: 'network', label: 'Network', canRefresh: true, isFullWidth: true },
  { id: 'processes', label: 'Processes', canRefresh: true, isFullWidth: true },
  { id: 'docker', label: 'Docker', canRefresh: true, isFullWidth: true }
];
