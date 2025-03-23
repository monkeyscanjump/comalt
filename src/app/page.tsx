"use client";

import React, { useContext, useEffect, useState } from 'react';
import AuthContext from '@/contexts/auth/AuthContext';
import { LoadingState } from '@/components/LoadingState';
import { FiRefreshCw, FiServer, FiSettings, FiAlertTriangle } from 'react-icons/fi';
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
  const auth = useContext(AuthContext);
  const [showSettings, setShowSettings] = useState(false);

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

  // If we're loading for the first time with no data, show a full loading state
  if (loading && !displayData) {
    return (
      <PageWrapper title="Dashboard" showInNav={true} order={1}>
        <LoadingState message="Loading system information..." />
      </PageWrapper>
    );
  }

  const isAnyRefreshInProgress = loading || isRefreshing || Object.values(componentRefreshing).some(v => v);

  return (
    <PageWrapper title="Dashboard" showInNav={true} order={1}>
      <div className={styles.container}>
        {/* Header with controls */}
        <div className={styles.header}>
          <div className={styles.titleContainer}>
            <h1 className={styles.title}>
              <FiServer className={styles.titleIcon} />
              System Dashboard
            </h1>
            {lastRefreshTime && (
              <span className={styles.lastRefresh}>
                Last updated: {new Date(lastRefreshTime).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className={styles.controls}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={styles.buttonSecondary}
              title="Dashboard settings"
            >
              <FiSettings className={styles.buttonIconLeft} />
              Settings
            </button>

            <button
              onClick={() => fetchSystemInfo(false)}
              className={styles.buttonPrimary}
              disabled={isAnyRefreshInProgress}
            >
              <FiRefreshCw className={`${styles.buttonIconLeft} ${isAnyRefreshInProgress ? styles.spinning : ''}`} />
              {isAnyRefreshInProgress ? 'Refreshing...' : 'Refresh All'}
            </button>
          </div>
        </div>

        {/* Error message at page top */}
        {error && (
          <div className={styles.errorBanner}>
            <div className={styles.errorContent}>
              <FiAlertTriangle className={styles.errorIcon} />
              <div className={styles.errorMessage}>
                <p className={styles.errorText}>{error}</p>
                <p className={styles.errorHint}>There was a problem updating the dashboard data. Previous data is still shown below.</p>
              </div>
            </div>
            <button
              onClick={() => retry()}
              className={styles.retryButton}
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
          <div className={styles.grid}>
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

          {/* Docker Information - As a dedicated component */}
          <DockerSection
            osInfo={displayData?.os}
            token={token ?? undefined}
            displayMode={displayMode}
          />
        </div>
      </div>
    </PageWrapper>
  );
}
