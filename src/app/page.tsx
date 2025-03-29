"use client";

import React, { useContext, useEffect, useState } from 'react';
import AuthContext from '@/contexts/auth/AuthContext';
import { LoadingState } from '@/components/LoadingState';
import { FiRefreshCw, FiServer, FiSettings, FiAlertTriangle } from 'react-icons/fi';
import pageStyles from '@/styles/pages.module.css';
import styles from './page.module.css';

// Import our modular components
import { MemorySection } from '@/components/dashboard/MemorySection';
import { CpuSection } from '@/components/dashboard/CpuSection';
import { OsSection } from '@/components/dashboard/OsSection';
import { StorageSection } from '@/components/dashboard/StorageSection';
import { NetworkSection } from '@/components/dashboard/NetworkSection';
import { GraphicsSection } from '@/components/dashboard/GraphicsSection';
import { ProcessesSection } from '@/components/dashboard/ProcessesSection';
import { DashboardSettings } from '@/components/dashboard/DashboardSettings';
import { DockerSection } from '@/components/dashboard/DockerSection';

// Import custom hooks
import { useSystemInfo } from '@/hooks/useSystemInfo';
import { useCollapsibleSections, SectionId } from '@/hooks/useCollapsibleSections';
import { useDashboardPreferences } from '@/hooks/useDashboardPreferences';
import { SystemInfoComponentKey } from '@/types/systemInfo';

// Import page wrapper for navigation
import { PageWrapper } from '@/components/layout/PageWrapper';

export default function Dashboard() {
  // All the hooks and logic remain unchanged
  const auth = useContext(AuthContext);
  const [showSettings, setShowSettings] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  if (!auth) {
    throw new Error('Dashboard must be used within AuthProvider');
  }

  const { token, isPublicMode } = auth;

  // Load user preferences
  const {
    displayMode,
    autoRefreshEnabled,
    autoRefreshInterval,
    visibleSections,
    setPreference
  } = useDashboardPreferences();

  // Load system information
  const {
    displayData,
    loading,
    isRefreshing,
    componentRefreshing,
    hasPm2Processes,
    cachedData,
    lastRefreshTime,
    error,
    fetchSystemInfo,
    fetchComponentData,
    retry
  } = useSystemInfo({
    token: token ?? undefined,
    isPublicMode,
    autoFetch: true,
    autoRefreshEnabled,
    refreshInterval: autoRefreshInterval
  });

  // Add timeout protection for loading state
  useEffect(() => {
    let loadingTimer: NodeJS.Timeout | null = null;

    if (loading && !displayData && !loadingTimeout) {
      console.log('[Dashboard] Setting up loading timeout protection (15s)');
      loadingTimer = setTimeout(() => {
        console.log('[Dashboard] Loading timeout triggered - still waiting for data');
        setLoadingTimeout(true);
      }, 15000); // 15 seconds timeout
    }

    return () => {
      if (loadingTimer) {
        clearTimeout(loadingTimer);
      }
    };
  }, [loading, displayData, loadingTimeout]);

  // Manage collapsible sections
  const {
    collapsedSections,
    toggleSectionCollapse,
    expandSection,
    collapseAllSections,
    expandAllSections
  } = useCollapsibleSections();

  // Handler for component refresh with auto-expand
  const handleComponentRefresh = (component: SystemInfoComponentKey, sectionId: SectionId) => {
    expandSection(sectionId);
    fetchComponentData(component);
  };

  // Time-based auto-refresh effect
  useEffect(() => {
    let refreshTimer: NodeJS.Timeout | undefined;

    if (autoRefreshEnabled && autoRefreshInterval > 0) {
      refreshTimer = setInterval(() => {
        fetchSystemInfo(false);
      }, autoRefreshInterval * 1000);
    }

    return () => {
      if (refreshTimer) clearInterval(refreshTimer);
    };
  }, [autoRefreshEnabled, autoRefreshInterval, fetchSystemInfo]);

  // Handle manual retry and reset timeout
  const handleRetry = () => {
    setLoadingTimeout(false);
    retry();
  };

  // If we're loading for the first time with no data, show a full loading state
  if (loading && !displayData) {
    return (
      <PageWrapper title="Dashboard" showInNav={true} order={1}>
        <div className={pageStyles.container}>
          <div className={pageStyles.header}>
            <h1 className={pageStyles.title}>
              <FiServer className={pageStyles.titleIcon} />
              System Dashboard
            </h1>
          </div>

          <LoadingState message="Loading system information..." />

          {/* Show error or timeout message */}
          {(error || loadingTimeout) && (
            <div className={pageStyles.error}>
              <div className={pageStyles.errorContent}>
                <FiAlertTriangle className={pageStyles.errorIcon} />
                <div className={pageStyles.errorMessage}>
                  <p className={pageStyles.errorText}>
                    {error || "Loading is taking longer than expected. The server might be busy or starting up."}
                  </p>
                </div>
              </div>
              <button
                onClick={handleRetry}
                className={pageStyles.retryButton}
                aria-label="Retry"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </PageWrapper>
    );
  }

  const isAnyRefreshInProgress = loading || isRefreshing || Object.values(componentRefreshing).some(v => v);

  return (
    <PageWrapper title="Dashboard" showInNav={true} order={1}>
      <div className={pageStyles.container}>
        {/* Header with controls */}
        <div className={pageStyles.header}>
          <div className={pageStyles.titleContainer}>
            <h1 className={pageStyles.title}>
              <FiServer className={pageStyles.titleIcon} />
              System Dashboard
            </h1>
            {lastRefreshTime && (
              <span className={pageStyles.subtitle}>
                Last updated: {new Date(lastRefreshTime).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className={pageStyles.actions}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={pageStyles.buttonSecondary}
              title="Dashboard settings"
            >
              <FiSettings className={pageStyles.buttonIconLeft} />
              Settings
            </button>

            <button
              onClick={() => fetchSystemInfo(false)}
              className={pageStyles.buttonPrimary}
              disabled={isAnyRefreshInProgress}
            >
              <FiRefreshCw className={`${pageStyles.buttonIconLeft} ${isAnyRefreshInProgress ? pageStyles.spinning : ''}`} />
              {isAnyRefreshInProgress ? 'Refreshing...' : 'Refresh All'}
            </button>
          </div>
        </div>

        {/* Error message at page top */}
        {error && (
          <div className={pageStyles.error}>
            <div className={pageStyles.errorContent}>
              <FiAlertTriangle className={pageStyles.errorIcon} />
              <div className={pageStyles.errorMessage}>
                <p className={pageStyles.errorText}>{error}</p>
                <p className={pageStyles.errorHint}>There was a problem updating the dashboard data. Previous data is still shown below.</p>
              </div>
            </div>
            <button
              onClick={() => retry()}
              className={pageStyles.retryButton}
              aria-label="Retry"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Settings panel (conditionally rendered) */}
        {showSettings && (
          <DashboardSettings
            preferences={{
              displayMode,
              autoRefreshEnabled,
              autoRefreshInterval,
              visibleSections
            }}
            onUpdatePreference={setPreference}
            onClose={() => setShowSettings(false)}
            onCollapseAll={collapseAllSections}
            onExpandAll={expandAllSections}
          />
        )}

        {/* Main dashboard content */}
        <div className={`${styles.contentWrapper} ${isRefreshing ? styles.refreshing : ''}`}>
          {/* Main grid for system info cards */}
          <div className={pageStyles.grid}>
            {/* Memory Information (only if visible in preferences) */}
            {visibleSections.memory && (
              <MemorySection
                memory={displayData?.memory}
                isRefreshing={componentRefreshing.memory}
                onRefresh={() => handleComponentRefresh('memory', 'memory')}
                displayMode={displayMode}
              />
            )}

            {/* OS Information */}
            {visibleSections.os && (
              <OsSection
                os={displayData?.os}
                uptime={displayData?.uptime ?? undefined}
                displayMode={displayMode}
              />
            )}

            {/* PM2 Processes */}
            {visibleSections.processes && hasPm2Processes && (
              <ProcessesSection
                processes={componentRefreshing.processes ? cachedData.pm2Processes : displayData?.pm2Processes}
                isRefreshing={componentRefreshing.processes}
                isCollapsed={collapsedSections.processes}
                onRefresh={() => handleComponentRefresh('processes', 'processes')}
                onToggleCollapse={() => toggleSectionCollapse('processes')}
                displayMode={displayMode}
              />
            )}
          </div>

          {/* CPU Information */}
          {visibleSections.cpu && (
            <CpuSection
              cpu={displayData?.cpu}
              isCollapsed={collapsedSections.cpu}
              onToggleCollapse={() => toggleSectionCollapse('cpu')}
              displayMode={displayMode}
            />
          )}

          {/* GPU Information */}
          {visibleSections.gpu && (
            <GraphicsSection
              graphics={displayData?.graphics}
              isCollapsed={collapsedSections.gpu}
              onToggleCollapse={() => toggleSectionCollapse('gpu')}
              displayMode={displayMode}
            />
          )}

          {/* Storage Information */}
          {visibleSections.storage && (
            <StorageSection
              disks={componentRefreshing.storage ? cachedData.disks : displayData?.disks}
              isRefreshing={componentRefreshing.storage}
              isCollapsed={collapsedSections.storage}
              onRefresh={() => handleComponentRefresh('storage', 'storage')}
              onToggleCollapse={() => toggleSectionCollapse('storage')}
              displayMode={displayMode}
            />
          )}

          {/* Network Information */}
          {visibleSections.network && (
            <NetworkSection
              network={componentRefreshing.network ? cachedData.network : displayData?.network}
              isRefreshing={componentRefreshing.network}
              isCollapsed={collapsedSections.network}
              onRefresh={() => handleComponentRefresh('network', 'network')}
              onToggleCollapse={() => toggleSectionCollapse('network')}
              displayMode={displayMode}
            />
          )}

          {/* Docker section */}
          {visibleSections.docker && (
            <DockerSection
              osInfo={displayData?.os}
              token={token ?? undefined}
              displayMode={displayMode}
              isCollapsed={collapsedSections.docker}
              onToggleCollapse={() => toggleSectionCollapse('docker')}
            />
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
