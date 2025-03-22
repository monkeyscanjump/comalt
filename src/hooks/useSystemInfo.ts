import { useState, useEffect, useCallback, useReducer } from 'react';
import type { SystemInfo, SystemInfoComponentKey } from '@/types/systemInfo';
import { transformSystemData } from '@/utils/dataTransformers';

// Key for storing system info in localStorage
const SYSTEM_INFO_STORAGE_KEY = 'dashboard_system_info';
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY = 2000; // 2 seconds

// Component to property mapping - properly typed to fix the TypeScript error
const COMPONENT_PROPERTY_MAP: Record<SystemInfoComponentKey, keyof SystemInfo> = {
  memory: 'memory',
  storage: 'disks',
  network: 'network',
  processes: 'pm2Processes'
};

// State reducer for complex state management
type SystemInfoState = {
  systemInfo: SystemInfo | null;
  displayData: SystemInfo | null;
  loading: boolean;
  isRefreshing: boolean;
  componentRefreshing: Record<SystemInfoComponentKey, boolean>;
  error: string | null;
  retryAttempts: number;
  cachedData: {
    disks: any[];
    pm2Processes: any[];
    network: any[];
  };
  hasPm2Processes: boolean;
  lastRefreshTime: number | null;
};

type SystemInfoAction =
  | { type: 'FETCH_START', isInitialFetch: boolean }
  | { type: 'FETCH_SUCCESS', data: SystemInfo }
  | { type: 'FETCH_ERROR', error: string }
  | { type: 'COMPONENT_REFRESH_START', component: SystemInfoComponentKey }
  | { type: 'COMPONENT_REFRESH_SUCCESS', component: SystemInfoComponentKey, data: Partial<SystemInfo> }
  | { type: 'COMPONENT_REFRESH_ERROR', component: SystemInfoComponentKey, error: string }
  | { type: 'UPDATE_CACHED_DATA' }
  | { type: 'RESET_ERROR' };

const initialState: SystemInfoState = {
  systemInfo: null,
  displayData: null,
  loading: true,
  isRefreshing: false,
  componentRefreshing: {
    memory: false,
    storage: false,
    network: false,
    processes: false
  },
  error: null,
  retryAttempts: 0,
  cachedData: {
    disks: [],
    pm2Processes: [],
    network: []
  },
  hasPm2Processes: false,
  lastRefreshTime: null
};

function systemInfoReducer(state: SystemInfoState, action: SystemInfoAction): SystemInfoState {
  switch (action.type) {
    case 'FETCH_START':
      return {
        ...state,
        loading: action.isInitialFetch || !state.systemInfo,
        isRefreshing: !action.isInitialFetch && !!state.systemInfo,
        error: null
      };

    case 'FETCH_SUCCESS':
      return {
        ...state,
        systemInfo: action.data,
        displayData: action.data,
        loading: false,
        isRefreshing: false,
        retryAttempts: 0,
        lastRefreshTime: Date.now()
      };

    case 'FETCH_ERROR':
      return {
        ...state,
        error: action.error,
        loading: false,
        isRefreshing: false,
        retryAttempts: state.retryAttempts + 1
      };

    case 'COMPONENT_REFRESH_START':
      return {
        ...state,
        componentRefreshing: {
          ...state.componentRefreshing,
          [action.component]: true
        }
      };

    case 'COMPONENT_REFRESH_SUCCESS': {
      // Create a new systemInfo object with updated component data
      const updatedSystemInfo = { ...state.systemInfo, ...action.data };

      return {
        ...state,
        systemInfo: updatedSystemInfo,
        // Only update displayData if no other refreshes are in progress
        displayData: Object.values(state.componentRefreshing).every(v => !v) ||
                     Object.values(state.componentRefreshing).filter(v => v).length === 1
                     ? updatedSystemInfo : state.displayData,
        componentRefreshing: {
          ...state.componentRefreshing,
          [action.component]: false
        },
        lastRefreshTime: Date.now()
      };
    }

    case 'COMPONENT_REFRESH_ERROR':
      return {
        ...state,
        componentRefreshing: {
          ...state.componentRefreshing,
          [action.component]: false
        }
      };

    case 'UPDATE_CACHED_DATA': {
      const newCachedData = { ...state.cachedData };
      const hasPm2Processes = !!state.displayData?.pm2Processes?.length;

      if (state.displayData?.disks?.length) {
        newCachedData.disks = state.displayData.disks;
      }

      if (state.displayData?.pm2Processes?.length) {
        newCachedData.pm2Processes = state.displayData.pm2Processes;
      }

      if (state.displayData?.network?.length) {
        newCachedData.network = state.displayData.network;
      }

      return {
        ...state,
        cachedData: newCachedData,
        hasPm2Processes
      };
    }

    case 'RESET_ERROR':
      return {
        ...state,
        error: null,
        retryAttempts: 0
      };

    default:
      return state;
  }
}

interface UseSystemInfoOptions {
  token?: string;
  isPublicMode?: boolean;
  autoFetch?: boolean;
  autoRefreshEnabled?: boolean;
  refreshInterval?: number;
}

export function useSystemInfo({
  token,
  isPublicMode = false,
  autoFetch = true,
  autoRefreshEnabled = false,
  refreshInterval = 60 // seconds
}: UseSystemInfoOptions = {}) {
  const [state, dispatch] = useReducer(systemInfoReducer, initialState);

  // Fetch complete system info - Define this first so we can use it in useEffect
  const fetchSystemInfo = useCallback(async (isInitialFetch = false) => {
    dispatch({ type: 'FETCH_START', isInitialFetch });

    try {
      const headers: HeadersInit = {};
      if (!isPublicMode && token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Implement retry logic
      let attempts = 0;
      let success = false;
      let response;

      while (!success && attempts < DEFAULT_RETRY_ATTEMPTS) {
        try {
          response = await fetch('/api/system', { headers });
          success = true;
        } catch (err) {
          attempts++;
          if (attempts >= DEFAULT_RETRY_ATTEMPTS) throw err;
          await new Promise(resolve => setTimeout(resolve, DEFAULT_RETRY_DELAY));
        }
      }

      if (!response || !response.ok) {
        let errorMessage = 'Failed to fetch system info';
        try {
          const errorData = await response?.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If parsing fails, use default error message
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Apply data transformations to ensure consistency
      const transformedData = transformSystemData(data);

      dispatch({ type: 'FETCH_SUCCESS', data: transformedData });
      localStorage.setItem(SYSTEM_INFO_STORAGE_KEY, JSON.stringify(transformedData));
    } catch (err) {
      console.error('Error fetching system info:', err);
      dispatch({
        type: 'FETCH_ERROR',
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }, [isPublicMode, token]);

  // Load persisted data on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(SYSTEM_INFO_STORAGE_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData);

        // Apply any data transformations to ensure consistency
        const transformedData = transformSystemData(parsedData);

        dispatch({ type: 'FETCH_SUCCESS', data: transformedData });
        dispatch({ type: 'UPDATE_CACHED_DATA' });
      }
    } catch (err) {
      console.error('Failed to load saved system info:', err);
    }
  }, []);

  // Update cache whenever display data changes
  useEffect(() => {
    if (state.displayData) {
      dispatch({ type: 'UPDATE_CACHED_DATA' });
    }
  }, [state.displayData]);

  // Auto-retry on error - Fixed missing dependency
  useEffect(() => {
    if (state.error && state.retryAttempts <= DEFAULT_RETRY_ATTEMPTS) {
      const timer = setTimeout(() => {
        fetchSystemInfo(true);
      }, DEFAULT_RETRY_DELAY * state.retryAttempts);

      return () => clearTimeout(timer);
    }
  }, [state.error, state.retryAttempts, fetchSystemInfo]); // Added fetchSystemInfo to dependencies

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefreshEnabled && refreshInterval > 0 && !state.loading) {
      const refreshTimer = setInterval(() => {
        fetchSystemInfo(false);
      }, refreshInterval * 1000);

      return () => clearInterval(refreshTimer);
    }
  }, [autoRefreshEnabled, refreshInterval, state.loading, fetchSystemInfo]); // Added fetchSystemInfo to dependencies

  // Fetch specific component data
  const fetchComponentData = useCallback(async (component: SystemInfoComponentKey) => {
    dispatch({ type: 'COMPONENT_REFRESH_START', component });

    try {
      // Prepare headers
      const headers: HeadersInit = {};
      if (!isPublicMode && token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Implement retry logic
      let attempts = 0;
      let success = false;
      let response;

      while (!success && attempts < DEFAULT_RETRY_ATTEMPTS) {
        try {
          response = await fetch(`/api/system?component=${component}`, { headers });
          success = true;
        } catch (err) {
          attempts++;
          if (attempts >= DEFAULT_RETRY_ATTEMPTS) throw err;
          await new Promise(resolve => setTimeout(resolve, DEFAULT_RETRY_DELAY));
        }
      }

      if (!response || !response.ok) {
        let errorMessage = `Failed to fetch ${component} info`;
        try {
          const errorData = await response?.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If parsing fails, use default error message
        }
        throw new Error(errorMessage);
      }

      // Parse the response
      const data = await response.json();
      const propertyKey = COMPONENT_PROPERTY_MAP[component];

      // Create data object to update
      const updatedData: Partial<SystemInfo> = {};

      // Check for the mapped property name in the response data
      if (data[propertyKey]) {
        updatedData[propertyKey] = data[propertyKey];
      } else {
        // Fallback to direct property access
        switch(component) {
          case 'processes':
            if (data.pm2Processes) updatedData.pm2Processes = data.pm2Processes;
            break;
          case 'storage':
            if (data.disks) updatedData.disks = data.disks;
            break;
          case 'memory':
            if (data.memory) updatedData.memory = data.memory;
            break;
          case 'network':
            if (data.network) updatedData.network = data.network;
            break;
        }
      }

      // Apply data transformations to ensure consistency
      const transformedData = transformSystemData({ ...state.systemInfo, ...updatedData });

      // Update state
      dispatch({
        type: 'COMPONENT_REFRESH_SUCCESS',
        component,
        data: updatedData
      });

      // Update localStorage with the new complete system info
      if (state.systemInfo) {
        localStorage.setItem(
          SYSTEM_INFO_STORAGE_KEY,
          JSON.stringify({ ...state.systemInfo, ...updatedData })
        );
      }
    } catch (err) {
      console.error(`Error fetching ${component} info:`, err);
      dispatch({
        type: 'COMPONENT_REFRESH_ERROR',
        component,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }, [isPublicMode, token, state.systemInfo]);

  // Manual retry function for error recovery
  const retry = useCallback(() => {
    dispatch({ type: 'RESET_ERROR' });
    fetchSystemInfo(true);
  }, [fetchSystemInfo]);

  // Auto-fetch on mount if requested - Fixed missing dependency
  useEffect(() => {
    if (autoFetch && !state.systemInfo && !state.isRefreshing && !state.loading) {
      fetchSystemInfo(true);
    }
  }, [autoFetch, state.systemInfo, state.isRefreshing, state.loading, fetchSystemInfo]); // Added fetchSystemInfo to dependencies

  return {
    ...state,
    fetchSystemInfo,
    fetchComponentData,
    retry
  };
}
