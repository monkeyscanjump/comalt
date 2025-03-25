import { useState, useEffect, useCallback } from 'react';
import { SectionId } from './useCollapsibleSections';

// Key for storing user preferences in localStorage
const PREFERENCES_KEY = 'dashboard_preferences';

// Available display modes
export type DisplayMode = 'default' | 'compact' | 'detailed';

// Preferences structure
export interface DashboardPreferences {
  displayMode: DisplayMode;
  autoRefreshEnabled: boolean;
  autoRefreshInterval: number; // in seconds
  visibleSections: Record<SectionId, boolean>;
}

// Default preferences
const DEFAULT_PREFERENCES: DashboardPreferences = {
  displayMode: 'default',
  autoRefreshEnabled: false,
  autoRefreshInterval: 60, // 1 minute
  visibleSections: {
    memory: true,
    os: true,
    processes: true,
    cpu: true,
    gpu: true,
    storage: true,
    network: true,
    docker: true
  }
};

export function useDashboardPreferences() {
  const [preferences, setPreferences] = useState<DashboardPreferences>(DEFAULT_PREFERENCES);
  const [initialized, setInitialized] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREFERENCES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to ensure all properties exist
        setPreferences({
          ...DEFAULT_PREFERENCES,
          ...parsed
        });
      }
      setInitialized(true);
    } catch (err) {
      console.error('Failed to load dashboard preferences:', err);
      setInitialized(true);
    }
  }, []);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    if (initialized) {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    }
  }, [preferences, initialized]);

  // Update a specific preference
  const setPreference = useCallback(<K extends keyof DashboardPreferences>(
    key: K,
    value: DashboardPreferences[K]
  ) => {
    setPreferences(prev => {
      const newPreferences = { ...prev, [key]: value };
      return newPreferences;
    });
  }, []);

  // Set section visibility
  const setSectionVisibility = useCallback((sectionId: SectionId, visible: boolean) => {
    setPreferences(prev => {
      const newVisibleSections = { ...prev.visibleSections, [sectionId]: visible };
      return { ...prev, visibleSections: newVisibleSections };
    });
  }, []);

  // Reset preferences to defaults
  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  return {
    ...preferences,
    setPreference,
    setSectionVisibility,
    resetPreferences,
    initialized
  };
}
