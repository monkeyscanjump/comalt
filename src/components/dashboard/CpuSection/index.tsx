import React from 'react';
import { FiCpu } from 'react-icons/fi';
import { SectionContainer } from '@/components/dashboard/SectionContainer';
import styles from '@/app/page.module.css';
import type { SystemCpu } from '@/types/systemInfo';
import type { BaseSectionProps } from '@/types/dashboard';

interface CpuSectionProps extends BaseSectionProps {
  // Support both legacy single CPU and array of CPUs
  cpu: SystemCpu | SystemCpu[] | undefined;
}

export const CpuSection: React.FC<CpuSectionProps> = ({
  cpu,
  isCollapsed = false,
  onToggleCollapse,
  displayMode,
  className
}) => {
  // Handle both single CPU object and array of CPUs for backward compatibility
  const cpuArray = cpu ? (Array.isArray(cpu) ? cpu : [cpu]) : [];

  // Get CPU count for fullWidth logic - use array length
  const cpuCount = cpuArray.length;

  // Only use full width if multiple CPUs or no CPU data
  const isFullWidth = cpuCount > 1 || cpuCount === 0;

  // For compact display, show minimal info
  if (displayMode === 'compact' && cpuCount > 0) {
    return (
      <SectionContainer
        title={`CPU${cpuCount > 1 ? 's' : ''}`}
        icon={FiCpu}
        isFullWidth={isFullWidth}
        isCollapsible={!!onToggleCollapse}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
        displayMode={displayMode}
        className={className}
      >
        <p className={styles.compactContent}>
          {cpuCount > 1 ? `${cpuCount} Processors • ` : ''}
          {cpuArray[0].brand || "Processor"} • {cpuArray[0].cores} cores • {cpuArray[0].speed}
        </p>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer
      title={`CPU${cpuCount > 1 ? 's' : ''}`}
      icon={FiCpu}
      isFullWidth={isFullWidth}
      isCollapsible={!!onToggleCollapse}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      displayMode={displayMode}
      className={className}
    >
      {cpuCount > 0 ? (
        <div className={styles.cpuGrid}>
          {/* Map through all CPUs in the array */}
          {cpuArray.map((processor, index) => (
            <div key={index} className={styles.componentItem}>
              <h3 className={styles.componentName}>
                {processor.brand || `Processor ${index + 1}`}
              </h3>
              <div className={styles.componentDetails}>
                <p><span className={styles.label}>Manufacturer:</span> {processor.manufacturer}</p>
                <p><span className={styles.label}>Cores:</span> {processor.cores} (Physical: {processor.physicalCores})</p>
                <p><span className={styles.label}>Speed:</span> {processor.speed}</p>
                {processor.socket && <p><span className={styles.label}>Socket:</span> {processor.socket}</p>}
                {displayMode === 'detailed' && (
                  <>
                    <p><span className={styles.label}>Family:</span> {processor.family}</p>
                    <p><span className={styles.label}>Model:</span> {processor.model}</p>
                    {processor.cache && (
                      <div className={styles.cacheInfo}>
                        <p><span className={styles.label}>Cache:</span></p>
                        <ul>
                          {processor.cache.l1d && <li>L1 Data: {processor.cache.l1d}</li>}
                          {processor.cache.l1i && <li>L1 Instruction: {processor.cache.l1i}</li>}
                          {processor.cache.l2 && <li>L2: {processor.cache.l2}</li>}
                          {processor.cache.l3 && <li>L3: {processor.cache.l3}</li>}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.emptyMessage}>No CPU information available</p>
      )}
    </SectionContainer>
  );
};
