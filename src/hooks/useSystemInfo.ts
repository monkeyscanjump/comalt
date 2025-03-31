import { useState, useEffect, useCallback, useReducer, useRef } from 'react'; // Added useRef
import type { SystemInfo, SystemInfoComponentKey } from '@/types/systemInfo';
import { transformSystemData } from '@/utils/dataTransformers';

// Key for storing system info in localStorage
const SYSTEM_INFO_STORAGE_KEY = 'dashboard_system_info';
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY = 2000; // 2 seconds
const FETCH_TIMEOUT = 15000; // 15 seconds timeout for fetch operations

// Component to property mapping - properly typed to fix the TypeScript error
const COMPONENT_PROPERTY_MAP: Record<SystemInfoComponentKey, keyof SystemInfo> = {
  memory: 'memory',
  storage: 'disks',
  network: 'network',
  processes: 'pm2Processes',
  docker: 'docker'
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
  | { type: 'FORCE_EXIT_LOADING' } // New action to force exit loading state
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
    processes: false,
    docker: false
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
        loading: false, // Ensure loading is set to false on error
        isRefreshing: false,
        retryAttempts: state.retryAttempts + 1
      };

    case 'FORCE_EXIT_LOADING': // New case to force exit loading state
      return {
        ...state,
        loading: false,
        isRefreshing: false,
        error: state.error || 'Loading timed out - please try again'
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
      const updatedSystemInfo = state.systemInfo ? { ...state.systemInfo, ...action.data } : action.data;

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

  // Add refs to track in-progress requests
  const fetchInProgressRef = useRef(false);
  const componentFetchInProgress = useRef<Record<SystemInfoComponentKey, boolean>>({
    memory: false,
    storage: false,
    network: false,
    processes: false,
    docker: false
  });

  // Debug logging function
  const logDebug = useCallback((message: string, data?: any) => {
    console.log(`[SystemInfo] ${message}`, data ? data : '');
  }, []);

  // Fetch complete system info - Define this first so we can use it in useEffect
  const fetchSystemInfo = useCallback(async (isInitialFetch = false) => {
    // Skip if a fetch is already in progress
    if (fetchInProgressRef.current) {
      logDebug('Skipping duplicate fetch - request already in progress');
      return;
    }

    // Set fetch in progress
    fetchInProgressRef.current = true;

    // Start a timeout to force exit loading state
    const timeoutId = setTimeout(() => {
      logDebug('TIMEOUT: Forcing exit from loading state');
      dispatch({ type: 'FORCE_EXIT_LOADING' });
      fetchInProgressRef.current = false; // Reset on timeout
    }, FETCH_TIMEOUT);

    dispatch({ type: 'FETCH_START', isInitialFetch });
    logDebug(`Starting fetch (initial: ${isInitialFetch})`, { token: !!token, isPublicMode });

    try {
      const headers: HeadersInit = {
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      };

      if (!isPublicMode && token) {
        headers.Authorization = `Bearer ${token}`;
        logDebug('Using authentication token');
      } else if (isPublicMode) {
        logDebug('Using public mode, no token needed');
      } else {
        logDebug('WARNING: No token and not in public mode');
      }

      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      const url = `/api/system?t=${timestamp}`;

      // Implement retry logic
      let attempts = 0;
      let success = false;
      let response = null;

      while (!success && attempts < DEFAULT_RETRY_ATTEMPTS) {
        try {
          logDebug(`Fetch attempt ${attempts + 1}/${DEFAULT_RETRY_ATTEMPTS}`);
          response = await fetch(url, {
            headers,
            cache: 'no-store',
            next: { revalidate: 0 }
          });
          success = true;
        } catch (err) {
          attempts++;
          logDebug(`Fetch network error (attempt ${attempts})`, err);
          if (attempts >= DEFAULT_RETRY_ATTEMPTS) throw err;
          await new Promise(resolve => setTimeout(resolve, DEFAULT_RETRY_DELAY));
        }
      }

      if (!response || !response.ok) {
        logDebug(`Fetch failed with status: ${response?.status}`);
        let errorMessage = `Failed to fetch system info (Status: ${response?.status || 'unknown'})`;

        try {
          const errorData = await response?.json();
          logDebug('Error response data:', errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          logDebug('Failed to parse error response', parseError);
          // If parsing fails, use default error message
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      logDebug('Fetch succeeded, data received');

      // Clear the timeout
      clearTimeout(timeoutId);

      // Apply data transformations to ensure consistency
      const transformedData = transformSystemData(data);

      dispatch({ type: 'FETCH_SUCCESS', data: transformedData });
      localStorage.setItem(SYSTEM_INFO_STORAGE_KEY, JSON.stringify(transformedData));
      logDebug('State updated with new data');
    } catch (err) {
      // Clear the timeout
      clearTimeout(timeoutId);

      logDebug('Error fetching system info:', err);
      dispatch({
        type: 'FETCH_ERROR',
        error: err instanceof Error ? err.message : String(err)
      });
    } finally {
      // Allow a small delay before allowing new requests
      setTimeout(() => {
        fetchInProgressRef.current = false;
      }, 100);
    }
  }, [isPublicMode, token, logDebug]);

  // Load persisted data on mount
  useEffect(() => {
    logDebug('Component mounted, checking for cached data');
    try {
      const savedData = localStorage.getItem(SYSTEM_INFO_STORAGE_KEY);
      if (savedData) {
        logDebug('Found cached data in localStorage');
        const parsedData = JSON.parse(savedData);

        // Apply any data transformations to ensure consistency
        const transformedData = transformSystemData(parsedData);

        dispatch({ type: 'FETCH_SUCCESS', data: transformedData });
        dispatch({ type: 'UPDATE_CACHED_DATA' });
        logDebug('Loaded cached data');
      } else {
        logDebug('No cached data found');
      }
    } catch (err) {
      logDebug('Failed to load saved system info:', err);
    }
  }, [logDebug]);

  // Update cache whenever display data changes
  useEffect(() => {
    if (state.displayData) {
      dispatch({ type: 'UPDATE_CACHED_DATA' });
    }
  }, [state.displayData]);

  // Auto-retry on error - FIXED: Added logDebug dependency
  useEffect(() => {
    if (state.error && state.retryAttempts <= DEFAULT_RETRY_ATTEMPTS) {
      logDebug(`Auto-retrying after error (attempt ${state.retryAttempts})`);
      const timer = setTimeout(() => {
        fetchSystemInfo(true);
      }, DEFAULT_RETRY_DELAY * state.retryAttempts);

      return () => clearTimeout(timer);
    }
  }, [state.error, state.retryAttempts, fetchSystemInfo, logDebug]); // Added logDebug

  // Auto-refresh effect - FIXED: Added logDebug dependency
  useEffect(() => {
    if (autoRefreshEnabled && refreshInterval > 0 && !state.loading) {
      logDebug(`Setting up auto-refresh interval: ${refreshInterval}s`);
      const refreshTimer = setInterval(() => {
        fetchSystemInfo(false);
      }, refreshInterval * 1000);

      return () => clearInterval(refreshTimer);
    }
  }, [autoRefreshEnabled, refreshInterval, state.loading, fetchSystemInfo, logDebug]); // Added logDebug

  // Fetch specific component data
  const fetchComponentData = useCallback(async (component: SystemInfoComponentKey) => {
    // Skip if a fetch for this component is already in progress
    if (componentFetchInProgress.current[component]) {
      logDebug(`Skipping duplicate fetch for component ${component} - request already in progress`);
      return;
    }

    // Set component fetch in progress
    componentFetchInProgress.current[component] = true;

    logDebug(`Fetching component data: ${component}`);
    dispatch({ type: 'COMPONENT_REFRESH_START', component });

    // Start a timeout to ensure component loading state is cleared
    const timeoutId = setTimeout(() => {
      logDebug(`TIMEOUT: Component refresh timed out: ${component}`);
      dispatch({
        type: 'COMPONENT_REFRESH_ERROR',
        component,
        error: 'Request timed out'
      });
      componentFetchInProgress.current[component] = false; // Reset on timeout
    }, FETCH_TIMEOUT);

    try {
      // Prepare headers
      const headers: HeadersInit = {
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      };

      if (!isPublicMode && token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      const url = `/api/system?component=${component}&t=${timestamp}`;

      // Implement retry logic
      let attempts = 0;
      let success = false;
      let response;

      while (!success && attempts < DEFAULT_RETRY_ATTEMPTS) {
        try {
          logDebug(`Component fetch attempt ${attempts + 1}/${DEFAULT_RETRY_ATTEMPTS}`);
          response = await fetch(url, {
            headers,
            cache: 'no-store',
            next: { revalidate: 0 }
          });
          success = true;
        } catch (err) {
          attempts++;
          logDebug(`Component fetch network error (attempt ${attempts})`, err);
          if (attempts >= DEFAULT_RETRY_ATTEMPTS) throw err;
          await new Promise(resolve => setTimeout(resolve, DEFAULT_RETRY_DELAY));
        }
      }

      if (!response || !response.ok) {
        logDebug(`Component fetch failed with status: ${response?.status}`);
        let errorMessage = `Failed to fetch ${component} info (Status: ${response?.status || 'unknown'})`;

        try {
          const errorData = await response?.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          // If parsing fails, use default error message
        }

        throw new Error(errorMessage);
      }

      // Clear the timeout
      clearTimeout(timeoutId);

      // Parse the response
      const data = await response.json();
      logDebug(`Component data received for ${component}`);

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
      const transformedData = state.systemInfo ?
        transformSystemData({ ...state.systemInfo, ...updatedData }) :
        transformSystemData(updatedData as SystemInfo);

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
      // Clear the timeout
      clearTimeout(timeoutId);

      logDebug(`Error fetching ${component} info:`, err);
      dispatch({
        type: 'COMPONENT_REFRESH_ERROR',
        component,
        error: err instanceof Error ? err.message : String(err)
      });
    } finally {
      // Allow a small delay before allowing new requests
      setTimeout(() => {
        componentFetchInProgress.current[component] = false;
      }, 100);
    }
  }, [isPublicMode, token, state.systemInfo, logDebug]);

  // Manual retry function for error recovery
  const retry = useCallback(() => {
    logDebug('Manual retry initiated');
    dispatch({ type: 'RESET_ERROR' });
    fetchSystemInfo(true);
  }, [fetchSystemInfo, logDebug]);

  // Force loading state to end if it's been stuck for too long
  useEffect(() => {
    if (state.loading) {
      logDebug('Setting up loading timeout safety');
      const forceLoadingExitTimer = setTimeout(() => {
        logDebug('TIMEOUT: Safety mechanism forcing exit from loading state');
        dispatch({ type: 'FORCE_EXIT_LOADING' });
      }, FETCH_TIMEOUT);

      return () => clearTimeout(forceLoadingExitTimer);
    }
  }, [state.loading, logDebug]);

  // Auto-fetch on mount if requested
  useEffect(() => {
    if (autoFetch) {
      logDebug('Auto-fetching on mount');
      fetchSystemInfo(true);
    }

    // Capture the current ref value when the effect runs
    // This prevents issues with the ref changing before cleanup
    const currentFetchInProgressRef = fetchInProgressRef;
    const currentComponentFetchRef = componentFetchInProgress.current;

    // Clean up refs on unmount
    return () => {
      // Use captured value instead of potentially changed ref.current
      if (currentFetchInProgressRef) {
        currentFetchInProgressRef.current = false;
      }

      // Use captured object instead of potentially changed ref.current
      if (currentComponentFetchRef) {
        Object.keys(currentComponentFetchRef).forEach(key => {
          const typedKey = key as SystemInfoComponentKey;
          currentComponentFetchRef[typedKey] = false;
        });
      }
    };
  }, [autoFetch, fetchSystemInfo, logDebug]);

  return {
    ...state,
    fetchSystemInfo,
    fetchComponentData,
    retry
  };
}
