import React from 'react';
import { FiHardDrive } from 'react-icons/fi';
import { SectionContainer } from '@/components/dashboard/SectionContainer';
import styles from '@/app/page.module.css';
import type { SystemDisk } from '@/types/systemInfo';
import type { BaseSectionProps } from '@/types/dashboard';

interface StorageSectionProps extends BaseSectionProps {
  disks: SystemDisk[] | undefined;
}

export const StorageSection: React.FC<StorageSectionProps> = ({
  disks,
  isRefreshing = false,
  isCollapsed = false,
  onRefresh,
  onToggleCollapse,
  displayMode,
  className
}) => {
  // For compact display, show minimal information
  if (displayMode === 'compact' && disks && disks.length > 0) {
    const totalDisks = disks.length;
    const totalStorage = disks
      .map(disk => parseFloat(disk.size.replace(/[^0-9.]/g, '')))
      .reduce((sum, size) => sum + size, 0)
      .toFixed(2);

    return (
      <SectionContainer
        title="Storage"
        icon={FiHardDrive}
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
          {totalDisks} drive{totalDisks !== 1 ? 's' : ''} • {totalStorage} GB total
        </p>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer
      title="Storage"
      icon={FiHardDrive}
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
      <div className={styles.storageGrid}>
        {disks && disks.length > 0 ? (
          disks.map((disk, index) => (
            <div key={index} className={styles.componentItem}>
              <h3 className={styles.componentName}>{disk.name || disk.device}</h3>
              <div className={styles.componentDetails}>
                <p><span className={styles.label}>Device:</span> {disk.device}</p>
                <p><span className={styles.label}>Type:</span> {disk.type}</p>
                <p><span className={styles.label}>Size:</span> {disk.size}</p>
                <p><span className={styles.label}>Vendor:</span> {disk.vendor}</p>
                {displayMode === 'detailed' && (
                  <>
                    <p><span className={styles.label}>Model:</span> {disk.model}</p>
                    <p><span className={styles.label}>Serial:</span> {disk.serial}</p>
                    <p><span className={styles.label}>Protocol:</span> {disk.protocol}</p>
                    <p><span className={styles.label}>Removable:</span> {disk.removable ? 'Yes' : 'No'}</p>
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className={styles.emptyMessage}>No storage information available</p>
        )}
      </div>
    </SectionContainer>
  );
};
