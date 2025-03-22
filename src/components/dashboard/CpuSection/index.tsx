import React from 'react';
import { FiCpu } from 'react-icons/fi';
import { SectionContainer } from '@/components/dashboard/SectionContainer';
import styles from '@/app/page.module.css';
import type { SystemCpu } from '@/types/systemInfo';
import type { BaseSectionProps } from '@/types/dashboard';

interface CpuSectionProps extends BaseSectionProps {
  cpu: SystemCpu | undefined;
}

export const CpuSection: React.FC<CpuSectionProps> = ({
  cpu,
  isCollapsed = false,
  onToggleCollapse,
  displayMode,
  className
}) => {
  // For compact display, show only essential information
  if (displayMode === 'compact' && cpu) {
    return (
      <SectionContainer
        title="CPU"
        icon={FiCpu}
        isFullWidth={true}
        isCollapsible={!!onToggleCollapse}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
        displayMode={displayMode}
        className={className}
      >
        <p className={styles.compactContent}>
          {cpu.brand || "Processor"} • {cpu.cores} cores • {cpu.speed}
        </p>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer
      title="CPU"
      icon={FiCpu}
      isFullWidth={true}
      isCollapsible={!!onToggleCollapse}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      displayMode={displayMode}
      className={className}
    >
      {cpu ? (
        <div className={styles.cpuGrid}>
          <div className={styles.componentItem}>
            <h3 className={styles.componentName}>{cpu.brand || "Processor"}</h3>
            <div className={styles.componentDetails}>
              <p><span className={styles.label}>Manufacturer:</span> {cpu.manufacturer}</p>
              <p><span className={styles.label}>Cores:</span> {cpu.cores} (Physical: {cpu.physicalCores})</p>
              <p><span className={styles.label}>Speed:</span> {cpu.speed}</p>
              {displayMode === 'detailed' && (
                <>
                  <p><span className={styles.label}>Family:</span> {cpu.family}</p>
                  <p><span className={styles.label}>Model:</span> {cpu.model}</p>
                  {cpu.cache && (
                    <div className={styles.cacheInfo}>
                      <p><span className={styles.label}>Cache:</span></p>
                      <ul>
                        {cpu.cache.l1d && <li>L1 Data: {cpu.cache.l1d}</li>}
                        {cpu.cache.l1i && <li>L1 Instruction: {cpu.cache.l1i}</li>}
                        {cpu.cache.l2 && <li>L2: {cpu.cache.l2}</li>}
                        {cpu.cache.l3 && <li>L3: {cpu.cache.l3}</li>}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className={styles.emptyMessage}>No CPU information available</p>
      )}
    </SectionContainer>
  );
};
