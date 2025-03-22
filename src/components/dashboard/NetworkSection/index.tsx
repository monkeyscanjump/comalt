import React from 'react';
import { FiWifi } from 'react-icons/fi';
import { SectionContainer } from '@/components/dashboard/SectionContainer';
import styles from '@/app/page.module.css';
import type { SystemNetworkInterface } from '@/types/systemInfo';
import type { BaseSectionProps } from '@/types/dashboard';

interface NetworkSectionProps extends BaseSectionProps {
  network: SystemNetworkInterface[] | undefined;
}

export const NetworkSection: React.FC<NetworkSectionProps> = ({
  network,
  isRefreshing = false,
  isCollapsed = false,
  onRefresh,
  onToggleCollapse,
  displayMode,
  className
}) => {
  // For compact display, show only active interfaces count
  if (displayMode === 'compact' && network && network.length > 0) {
    const activeInterfaces = network.filter(iface => iface.operstate === 'up').length;
    const totalInterfaces = network.length;

    return (
      <SectionContainer
        title="Network"
        icon={FiWifi}
        isFullWidth={true}
        isRefreshing={isRefreshing}
        canRefresh={!!onRefresh}
        isCollapsible={!!onToggleCollapse}
        isCollapsed={isCollapsed}
        onRefresh={onRefresh}
        onToggleCollapse={onToggleCollapse}
        displayMode={displayMode}
        className={className}
      >
        <p className={styles.compactContent}>
          {activeInterfaces} active of {totalInterfaces} interface{totalInterfaces !== 1 ? 's' : ''}
        </p>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer
      title="Network"
      icon={FiWifi}
      isFullWidth={true}
      isRefreshing={isRefreshing}
      canRefresh={!!onRefresh}
      isCollapsible={!!onToggleCollapse}
      isCollapsed={isCollapsed}
      onRefresh={onRefresh}
      onToggleCollapse={onToggleCollapse}
      displayMode={displayMode}
      className={className}
    >
      <div className={styles.networkGrid}>
        {network && network.length > 0 ? (
          network.map((iface, index) => (
            <div key={index} className={styles.componentItem}>
              <h3 className={styles.componentName}>
                {iface.iface} ({iface.type})
                <span className={`${styles.badge} ${
                  iface.operstate === 'up' ? styles.badgeSuccess :
                  iface.operstate === 'down' ? styles.badgeError :
                  styles.badgeWarning
                }`}>
                  {iface.operstate}
                </span>
              </h3>
              <div className={styles.componentDetails}>
                <p><span className={styles.label}>IP (v4):</span> {iface.ip4}</p>
                <p><span className={styles.label}>IP (v6):</span> {iface.ip6}</p>
                <p><span className={styles.label}>MAC:</span> {iface.mac}</p>
                <p><span className={styles.label}>Speed:</span> {iface.speed}</p>
                {displayMode === 'detailed' && (
                  <>
                    <p><span className={styles.label}>DHCP:</span> {iface.dhcp ? 'Yes' : 'No'}</p>
                    <p><span className={styles.label}>Internal:</span> {iface.internal ? 'Yes' : 'No'}</p>
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className={styles.emptyMessage}>No network information available</p>
        )}
      </div>
    </SectionContainer>
  );
};
