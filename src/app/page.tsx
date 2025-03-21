"use client";

import React, { useEffect, useState, useContext, useCallback } from 'react';
import AuthContext from '@/contexts/auth/AuthContext';
import { LoadingState } from '@/components/LoadingState';
import styles from './page.module.css';
import type { SystemInfo, SystemInfoComponentKey, ComponentToPropertyMap } from '@/types/systemInfo';

// Import icons
import {
  FiCpu,
  FiHardDrive,
  FiServer,
  FiDatabase,
  FiActivity,
  FiRefreshCw,
  FiAlertTriangle,
  FiMonitor,
  FiWifi,
  FiChevronDown,
  FiChevronUp
} from 'react-icons/fi';

// Key for storing system info in localStorage
const SYSTEM_INFO_STORAGE_KEY = 'dashboard_system_info';
// Key for storing collapse state in localStorage
const COLLAPSE_STATE_KEY = 'dashboard_collapse_state';

// Component to property mapping
const COMPONENT_PROPERTY_MAP: ComponentToPropertyMap = {
  memory: 'memory',
  storage: 'disks',
  network: 'network',
  processes: 'pm2Processes'
};

// Section IDs for collapse state
type SectionId = 'memory' | 'os' | 'processes' | 'cpu' | 'gpu' | 'storage' | 'network';

export default function Dashboard() {
  // Use existing AuthContext
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error('Dashboard must be used within AuthProvider');
  }

  const { isAuthenticated, isLoading, token, isPublicMode } = auth;
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Section-specific refreshing states
  const [isMemoryRefreshing, setIsMemoryRefreshing] = useState(false);
  const [isStorageRefreshing, setIsStorageRefreshing] = useState(false);
  const [isNetworkRefreshing, setIsNetworkRefreshing] = useState(false);
  const [isProcessesRefreshing, setIsProcessesRefreshing] = useState(false);

  // Display state to preserve visibility during refresh
  const [displayData, setDisplayData] = useState<SystemInfo | null>(null);

  // Cached section data to prevent disappearing during refresh
  const [cachedDisks, setCachedDisks] = useState<any[]>([]);
  const [cachedProcesses, setCachedProcesses] = useState<any[]>([]);
  const [cachedNetwork, setCachedNetwork] = useState<any[]>([]);

  // State to preserve section visibility during refresh
  const [hasPm2Processes, setHasPm2Processes] = useState(false);

  // Collapsed sections state
  const [collapsedSections, setCollapsedSections] = useState<Record<SectionId, boolean>>({
    memory: false,
    os: false,
    processes: false,
    cpu: false,
    gpu: false,
    storage: false,
    network: false,
  });

  const [error, setError] = useState<string | null>(null);

  // Toggle section collapse state
  const toggleSectionCollapse = useCallback((sectionId: SectionId) => {
    setCollapsedSections(prev => {
      const newState = { ...prev, [sectionId]: !prev[sectionId] };
      // Save to localStorage
      localStorage.setItem(COLLAPSE_STATE_KEY, JSON.stringify(newState));
      return newState;
    });
  }, []);

  // Expand a section if it's collapsed
  const expandSection = useCallback((sectionId: SectionId) => {
    if (collapsedSections[sectionId]) {
      setCollapsedSections(prev => {
        const newState = { ...prev, [sectionId]: false };
        // Save to localStorage
        localStorage.setItem(COLLAPSE_STATE_KEY, JSON.stringify(newState));
        return newState;
      });
    }
  }, [collapsedSections]);

  // Load collapse state from localStorage
  useEffect(() => {
    try {
      const savedCollapseState = localStorage.getItem(COLLAPSE_STATE_KEY);
      if (savedCollapseState) {
        const parsedState = JSON.parse(savedCollapseState);
        setCollapsedSections(prevState => ({
          ...prevState,
          ...parsedState
        }));
      }
    } catch (err) {
      console.error('Failed to load section collapse state:', err);
    }
  }, []);

  // Load persisted data on component mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(SYSTEM_INFO_STORAGE_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setSystemInfo(parsedData);
        setDisplayData(parsedData); // Initialize display data

        // Cache section data to prevent disappearing during refresh
        if (parsedData.disks && parsedData.disks.length > 0) {
          setCachedDisks(parsedData.disks);
        }

        if (parsedData.pm2Processes && parsedData.pm2Processes.length > 0) {
          setCachedProcesses(parsedData.pm2Processes);
          setHasPm2Processes(true);
        }

        if (parsedData.network && parsedData.network.length > 0) {
          setCachedNetwork(parsedData.network);
        }

        setLoading(false); // We already have data, no need for initial loading state
      }
    } catch (err) {
      console.error('Failed to load saved system info:', err);
    }
  }, []);

  // Cache sections data whenever they're updated
  useEffect(() => {
    if (displayData) {
      if (displayData.disks && displayData.disks.length > 0) {
        setCachedDisks(displayData.disks);
      }

      if (displayData.pm2Processes && displayData.pm2Processes.length > 0) {
        setCachedProcesses(displayData.pm2Processes);
        setHasPm2Processes(true);
      }

      if (displayData.network && displayData.network.length > 0) {
        setCachedNetwork(displayData.network);
      }
    }
  }, [displayData]);

  // Synchronize display data when systemInfo is fully updated
  useEffect(() => {
    if (systemInfo &&
        !isMemoryRefreshing &&
        !isStorageRefreshing &&
        !isNetworkRefreshing &&
        !isProcessesRefreshing &&
        !isRefreshing) {
      setDisplayData(systemInfo);
    }
  }, [
    systemInfo,
    isMemoryRefreshing,
    isStorageRefreshing,
    isNetworkRefreshing,
    isProcessesRefreshing,
    isRefreshing
  ]);

  // Fetch specific component data
  const fetchComponentData = useCallback(async (component: SystemInfoComponentKey) => {
    // Auto-expand the section when refreshing it
    switch (component) {
      case 'memory':
        expandSection('memory');
        setIsMemoryRefreshing(true);
        break;
      case 'storage':
        expandSection('storage');
        setIsStorageRefreshing(true);
        break;
      case 'network':
        expandSection('network');
        setIsNetworkRefreshing(true);
        break;
      case 'processes':
        expandSection('processes');
        setIsProcessesRefreshing(true);
        break;
    }

    try {
      // CRITICAL: Get current complete system info from localStorage
      const currentSavedData = localStorage.getItem(SYSTEM_INFO_STORAGE_KEY);
      const currentCompleteSystemInfo = currentSavedData ? JSON.parse(currentSavedData) : systemInfo;

      // Store this complete data to preserve it during refresh
      const preservedSystemInfo = { ...currentCompleteSystemInfo };

      // Prepare headers
      const headers: HeadersInit = {};
      if (!isPublicMode && token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Make the API request with the component parameter
      const response = await fetch(`/api/system?component=${component}`, { headers });

      if (!response.ok) {
        let errorMessage = `Failed to fetch ${component} info`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If parsing fails, use default error message
        }
        throw new Error(errorMessage);
      }

      // Parse the response
      const data = await response.json();

      // CRITICAL: Map the component name to the correct property in SystemInfo
      const propertyKey = COMPONENT_PROPERTY_MAP[component];

      // Create an updated version of the complete system info
      const updatedSystemInfo = { ...preservedSystemInfo };

      // Check for the mapped property name in the response data
      if (data[propertyKey]) {
        updatedSystemInfo[propertyKey] = data[propertyKey];
      } else {
        // If still missing, try a direct approach based on the API's structure
        switch(component) {
          case 'processes':
            if (data.pm2Processes) {
              updatedSystemInfo.pm2Processes = data.pm2Processes;
            }
            break;
          case 'storage':
            if (data.disks) {
              updatedSystemInfo.disks = data.disks;
            }
            break;
          case 'memory':
            if (data.memory) {
              updatedSystemInfo.memory = data.memory;
            }
            break;
          case 'network':
            if (data.network) {
              updatedSystemInfo.network = data.network;
            }
            break;
        }
      }

      // Update state with the COMPLETE updated system info
      setSystemInfo(updatedSystemInfo);

      // Save the COMPLETE updated system info to localStorage
      localStorage.setItem(SYSTEM_INFO_STORAGE_KEY, JSON.stringify(updatedSystemInfo));

    } catch (err) {
      console.error(`Error fetching ${component} info:`, err);
      // We don't set the global error for component-specific errors
    } finally {
      // Reset the specific component's loading state
      switch (component) {
        case 'memory':
          setIsMemoryRefreshing(false);
          break;
        case 'storage':
          setIsStorageRefreshing(false);
          break;
        case 'network':
          setIsNetworkRefreshing(false);
          break;
        case 'processes':
          setIsProcessesRefreshing(false);
          break;
      }
    }
  }, [token, isPublicMode, systemInfo, expandSection]);

  // Use useCallback to memoize the fetchSystemInfo function
  const fetchSystemInfo = useCallback(async (isInitialFetch = false) => {
    // If it's a refresh (not initial fetch) and we have data, just set refreshing state
    if (!isInitialFetch && systemInfo) {
      setIsRefreshing(true);
    } else {
      // Otherwise, set full loading state
      setLoading(true);
    }

    setError(null);

    try {
      // In public mode, we don't need to send the auth token
      const headers: HeadersInit = {};
      if (!isPublicMode && token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch('/api/system', { headers });

      if (!response.ok) {
        let errorMessage = 'Failed to fetch system info';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If parsing fails, use default error message
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setSystemInfo(data);

      // Save to localStorage for persistence
      localStorage.setItem(SYSTEM_INFO_STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Error fetching system info:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [token, isPublicMode, systemInfo]); // Include systemInfo in deps

  // Fetch system info when appropriate
  useEffect(() => {
    if (!isLoading && (isPublicMode || (isAuthenticated && token)) && !systemInfo) {
      fetchSystemInfo(true);
    }
  }, [isLoading, isAuthenticated, token, isPublicMode, fetchSystemInfo, systemInfo]);

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <h2 className={styles.errorTitle}>
            <FiAlertTriangle className={styles.errorIcon} />
            Error
          </h2>
          <p className={styles.errorMessage}>{error}</p>
          <button
            onClick={() => fetchSystemInfo(true)}
            className={styles.button}
          >
            <FiRefreshCw className={styles.buttonIcon} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header with title and refresh button on the same line */}
      <div className={styles.header}>
        <h1 className={styles.title}>System Dashboard</h1>
        <button
          onClick={() => fetchSystemInfo(false)}
          className={styles.button}
          disabled={loading || isRefreshing || isMemoryRefreshing || isStorageRefreshing || isNetworkRefreshing || isProcessesRefreshing}
        >
          <FiRefreshCw className={`${styles.buttonIcon} ${isRefreshing ? styles.spinning : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh System Info'}
        </button>
      </div>

      {loading && !displayData ? (
        <LoadingState message="Loading system information..." />
      ) : (
        <div className={`${styles.contentWrapper} ${isRefreshing ? styles.refreshing : ''}`}>
          {/* Main grid for remaining system info cards */}
          <div className={styles.grid}>
            {/* Memory Information - Always shown */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <FiDatabase className={styles.cardIcon} />
                Memory
                {/* Refresh button moved right after title */}
                <button
                  className={styles.sectionRefreshButton}
                  onClick={() => fetchComponentData('memory')}
                  disabled={isRefreshing || isMemoryRefreshing}
                  title="Refresh memory information"
                >
                  <FiRefreshCw className={`${isMemoryRefreshing ? styles.spinning : ''}`} />
                </button>
                {/* No collapse button for non-full width sections */}
              </h2>

              <div className={`${styles.cardContent} ${isMemoryRefreshing ? styles.refreshing : ''}`}>
                {displayData?.memory && (
                  <>
                    <p><span className={styles.label}>Total:</span> {displayData.memory.total}</p>
                    <p><span className={styles.label}>Used:</span> {displayData.memory.used} ({displayData.memory.percentUsed})</p>
                    <p><span className={styles.label}>Free:</span> {displayData.memory.free}</p>
                  </>
                )}
              </div>
            </div>

            {/* OS Information */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <FiServer className={styles.cardIcon} />
                Operating System
                {/* No refresh button for OS info */}
              </h2>

              <div className={styles.cardContent}>
                {displayData?.os && (
                  <>
                    <p><span className={styles.label}>Platform:</span> {displayData.os.platform}</p>
                    <p><span className={styles.label}>Distribution:</span> {displayData.os.distro}</p>
                    <p><span className={styles.label}>Release:</span> {displayData.os.release}</p>
                    <p><span className={styles.label}>Kernel:</span> {displayData.os.kernel}</p>
                    <p><span className={styles.label}>Architecture:</span> {displayData.os.arch}</p>
                    <p><span className={styles.label}>Uptime:</span> {displayData.uptime}</p>
                  </>
                )}
              </div>
            </div>

            {/* PM2 Processes - Always visible once detected */}
            {hasPm2Processes && (
              <div className={`${styles.card} ${styles.fullWidth}`}>
                <h2 className={styles.cardTitle}>
                  <FiActivity className={styles.cardIcon} />
                  PM2 Processes
                  {/* Refresh button moved right after title */}
                  <button
                    className={styles.sectionRefreshButton}
                    onClick={() => fetchComponentData('processes')}
                    disabled={isRefreshing || isProcessesRefreshing}
                    title="Refresh process information"
                  >
                    <FiRefreshCw className={`${isProcessesRefreshing ? styles.spinning : ''}`} />
                  </button>

                  {/* Collapse/expand button */}
                  <button
                    className={styles.collapseButton}
                    onClick={() => toggleSectionCollapse('processes')}
                    title={collapsedSections.processes ? "Expand section" : "Collapse section"}
                  >
                    {collapsedSections.processes ? <FiChevronDown /> : <FiChevronUp />}
                  </button>
                </h2>

                {/* Conditional rendering based on collapsed state */}
                {!collapsedSections.processes && (
                  <div className={`${styles.tableContainer} ${isProcessesRefreshing ? styles.refreshing : ''}`}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.tableHeader}>Name</th>
                          <th className={styles.tableHeader}>PID</th>
                          <th className={styles.tableHeader}>Status</th>
                          <th className={styles.tableHeader}>CPU</th>
                          <th className={styles.tableHeader}>Memory</th>
                          <th className={styles.tableHeader}>Uptime</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Use cachedProcesses during refresh, otherwise use displayData.pm2Processes */}
                        {(isProcessesRefreshing ? cachedProcesses : (displayData?.pm2Processes || [])).map((process, index) => (
                          <tr key={index} className={styles.tableRow}>
                            <td className={styles.tableCell}>{process.name}</td>
                            <td className={styles.tableCell}>{process.pid}</td>
                            <td className={styles.tableCell}>
                              <span className={`${styles.badge} ${
                                process.status === 'online' ? styles.badgeSuccess :
                                process.status === 'stopping' ? styles.badgeWarning :
                                styles.badgeError
                              }`}>
                                {process.status}
                              </span>
                            </td>
                            <td className={styles.tableCell}>{process.cpu}</td>
                            <td className={styles.tableCell}>{process.memory}</td>
                            <td className={styles.tableCell}>{process.uptime}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* CPU Information - Full width row */}
            <div className={`${styles.card} ${styles.fullWidth}`}>
              <h2 className={styles.cardTitle}>
                <FiCpu className={styles.cardIcon} />
                CPU
                {/* No refresh button for CPU info */}

                {/* Collapse/expand button */}
                <button
                  className={styles.collapseButton}
                  onClick={() => toggleSectionCollapse('cpu')}
                  title={collapsedSections.cpu ? "Expand section" : "Collapse section"}
                >
                  {collapsedSections.cpu ? <FiChevronDown /> : <FiChevronUp />}
                </button>
              </h2>

              {/* Conditional rendering based on collapsed state */}
              {!collapsedSections.cpu && (
                <div className={styles.cardContent}>
                  {displayData?.cpu ? (
                    <div className={styles.cpuGrid}>
                      <div className={styles.componentItem}>
                        <h3 className={styles.componentName}>{displayData.cpu.brand || "Processor"}</h3>
                        <div className={styles.componentDetails}>
                          <p><span className={styles.label}>Manufacturer:</span> {displayData.cpu.manufacturer}</p>
                          <p><span className={styles.label}>Cores:</span> {displayData.cpu.cores} (Physical: {displayData.cpu.physicalCores})</p>
                          <p><span className={styles.label}>Speed:</span> {displayData.cpu.speed}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p>No CPU information available</p>
                  )}
                </div>
              )}
            </div>

            {/* GPU Information - Full width row */}
            <div className={`${styles.card} ${styles.fullWidth}`}>
              <h2 className={styles.cardTitle}>
                <FiMonitor className={styles.cardIcon} />
                Graphics
                {/* No refresh button for GPU info */}

                {/* Collapse/expand button */}
                <button
                  className={styles.collapseButton}
                  onClick={() => toggleSectionCollapse('gpu')}
                  title={collapsedSections.gpu ? "Expand section" : "Collapse section"}
                >
                  {collapsedSections.gpu ? <FiChevronDown /> : <FiChevronUp />}
                </button>
              </h2>

              {/* Conditional rendering based on collapsed state */}
              {!collapsedSections.gpu && (
                <div className={styles.cardContent}>
                  {displayData?.graphics && displayData.graphics.length > 0 ? (
                    <div className={styles.gpuGrid}>
                      {displayData.graphics.map((gpu, index) => (
                        <div key={index} className={styles.componentItem}>
                          <h3 className={styles.componentName}>{gpu.model || "Graphics Adapter"}</h3>
                          <div className={styles.componentDetails}>
                            <p><span className={styles.label}>Vendor:</span> {gpu.vendor}</p>
                            <p><span className={styles.label}>Model:</span> {gpu.model}</p>
                            {gpu.vram && <p><span className={styles.label}>VRAM:</span> {gpu.vram}</p>}
                            {gpu.driverVersion && <p><span className={styles.label}>Driver:</span> {gpu.driverVersion}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No graphics information available</p>
                  )}
                </div>
              )}
            </div>

            {/* Storage Information - Full width row */}
            <div className={`${styles.card} ${styles.fullWidth}`}>
              <h2 className={styles.cardTitle}>
                <FiHardDrive className={styles.cardIcon} />
                Storage
                {/* Refresh button moved right after title */}
                <button
                  className={styles.sectionRefreshButton}
                  onClick={() => fetchComponentData('storage')}
                  disabled={isRefreshing || isStorageRefreshing}
                  title="Refresh storage information"
                >
                  <FiRefreshCw className={`${isStorageRefreshing ? styles.spinning : ''}`} />
                </button>

                {/* Collapse/expand button */}
                <button
                  className={styles.collapseButton}
                  onClick={() => toggleSectionCollapse('storage')}
                  title={collapsedSections.storage ? "Expand section" : "Collapse section"}
                >
                  {collapsedSections.storage ? <FiChevronDown /> : <FiChevronUp />}
                </button>
              </h2>

              {/* Conditional rendering based on collapsed state */}
              {!collapsedSections.storage && (
                <div className={`${styles.cardContent} ${isStorageRefreshing ? styles.refreshing : ''}`}>
                  <div className={styles.storageGrid}>
                    {/* Use cachedDisks during refresh, otherwise use displayData.disks */}
                    {(isStorageRefreshing ? cachedDisks : (displayData?.disks || [])).map((disk, index) => (
                      <div key={index} className={styles.componentItem}>
                        <h3 className={styles.componentName}>{disk.name || disk.device}</h3>
                        <div className={styles.componentDetails}>
                          <p><span className={styles.label}>Device:</span> {disk.device}</p>
                          <p><span className={styles.label}>Type:</span> {disk.type}</p>
                          <p><span className={styles.label}>Size:</span> {disk.size}</p>
                          <p><span className={styles.label}>Vendor:</span> {disk.vendor}</p>
                        </div>
                      </div>
                    ))}
                    {displayData?.disks?.length === 0 && cachedDisks.length === 0 && (
                      <p>No storage information available</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Network Information - Full width row */}
            <div className={`${styles.card} ${styles.fullWidth}`}>
              <h2 className={styles.cardTitle}>
                <FiWifi className={styles.cardIcon} />
                Network
                {/* Refresh button moved right after title */}
                <button
                  className={styles.sectionRefreshButton}
                  onClick={() => fetchComponentData('network')}
                  disabled={isRefreshing || isNetworkRefreshing}
                  title="Refresh network information"
                >
                  <FiRefreshCw className={`${isNetworkRefreshing ? styles.spinning : ''}`} />
                </button>

                {/* Collapse/expand button */}
                <button
                  className={styles.collapseButton}
                  onClick={() => toggleSectionCollapse('network')}
                  title={collapsedSections.network ? "Expand section" : "Collapse section"}
                >
                  {collapsedSections.network ? <FiChevronDown /> : <FiChevronUp />}
                </button>
              </h2>

              {/* Conditional rendering based on collapsed state */}
              {!collapsedSections.network && (
                <div className={`${styles.cardContent} ${isNetworkRefreshing ? styles.refreshing : ''}`}>
                  <div className={styles.networkGrid}>
                    {/* Use cachedNetwork during refresh, otherwise use displayData.network */}
                    {(isNetworkRefreshing ? cachedNetwork : (displayData?.network || [])).map((iface, index) => (
                      <div key={index} className={styles.componentItem}>
                        <h3 className={styles.componentName}>{iface.iface} ({iface.type})</h3>
                        <div className={styles.componentDetails}>
                          <p><span className={styles.label}>IP (v4):</span> {iface.ip4}</p>
                          <p><span className={styles.label}>IP (v6):</span> {iface.ip6}</p>
                          <p><span className={styles.label}>MAC:</span> {iface.mac}</p>
                          <p><span className={styles.label}>Speed:</span> {iface.speed}</p>
                          <p>
                            <span className={styles.label}>State:</span>
                            <span className={`${styles.badge} ${
                              iface.operstate === 'up' ? styles.badgeSuccess :
                              iface.operstate === 'down' ? styles.badgeError :
                              styles.badgeWarning
                            }`}>
                              {iface.operstate}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                    {displayData?.network?.length === 0 && cachedNetwork.length === 0 && (
                      <p>No network information available</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
