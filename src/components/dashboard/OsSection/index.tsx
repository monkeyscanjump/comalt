import React from 'react';
import { FiServer } from 'react-icons/fi';
import { SectionContainer } from '@/components/dashboard/SectionContainer';
import styles from '@/app/page.module.css';
import type { SystemOs } from '@/types/systemInfo';
import type { BaseSectionProps } from '@/types/dashboard';

interface OsSectionProps extends BaseSectionProps {
  os: SystemOs | undefined;
  uptime: string | undefined;
}

export const OsSection: React.FC<OsSectionProps> = ({
  os,
  uptime,
  isCollapsed = false,
  onToggleCollapse,
  displayMode,
  className
}) => {
  // For compact display, show only essential information
  if (displayMode === 'compact' && os) {
    return (
      <SectionContainer
        title="Operating System"
        icon={FiServer}
        isCollapsible={!!onToggleCollapse}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
        displayMode={displayMode}
        className={className}
      >
        <p className={styles.compactContent}>
          {os.distro} {os.release} • {os.arch} • Up: {uptime}
        </p>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer
      title="Operating System"
      icon={FiServer}
      isCollapsible={!!onToggleCollapse}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      displayMode={displayMode}
      className={className}
    >
      {os ? (
        <div className={styles.osInfo}>
          <p><span className={styles.label}>Platform:</span> {os.platform}</p>
          <p><span className={styles.label}>Distribution:</span> {os.distro}</p>
          <p><span className={styles.label}>Release:</span> {os.release}</p>
          <p><span className={styles.label}>Kernel:</span> {os.kernel}</p>
          <p><span className={styles.label}>Architecture:</span> {os.arch}</p>
          <p><span className={styles.label}>Uptime:</span> {uptime}</p>
          {displayMode === 'detailed' && os.hostname && (
            <p><span className={styles.label}>Hostname:</span> {os.hostname}</p>
          )}
        </div>
      ) : (
        <p className={styles.emptyMessage}>No operating system information available</p>
      )}
    </SectionContainer>
  );
};
