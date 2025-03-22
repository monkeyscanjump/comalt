import React from 'react';
import { FiMonitor } from 'react-icons/fi';
import { SectionContainer } from '@/components/dashboard/SectionContainer';
import styles from '@/app/page.module.css';
import type { SystemGraphics } from '@/types/systemInfo';
import type { BaseSectionProps } from '@/types/dashboard';

interface GraphicsSectionProps extends BaseSectionProps {
  graphics: SystemGraphics[] | undefined;
}

export const GraphicsSection: React.FC<GraphicsSectionProps> = ({
  graphics,
  isCollapsed = false,
  onToggleCollapse,
  displayMode,
  className
}) => {
  // For compact display, just show count and main GPU model
  if (displayMode === 'compact' && graphics && graphics.length > 0) {
    const gpuCount = graphics.length;
    const mainGpu = graphics[0].model;

    return (
      <SectionContainer
        title="Graphics"
        icon={FiMonitor}
        isFullWidth={true}
        isCollapsible={!!onToggleCollapse}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
        displayMode={displayMode}
        className={className}
      >
        <p className={styles.compactContent}>
          {gpuCount > 1 ? `${gpuCount} GPUs • ` : ''}
          {mainGpu}{graphics[0].vram !== 'N/A' ? ` • ${graphics[0].vram}` : ''}
        </p>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer
      title="Graphics"
      icon={FiMonitor}
      isFullWidth={true}
      isCollapsible={!!onToggleCollapse}
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      displayMode={displayMode}
      className={className}
    >
      {graphics && graphics.length > 0 ? (
        <div className={styles.gpuGrid}>
          {graphics.map((gpu, index) => (
            <div key={index} className={styles.componentItem}>
              <h3 className={styles.componentName}>{gpu.model || "Graphics Adapter"}</h3>
              <div className={styles.componentDetails}>
                <p><span className={styles.label}>Vendor:</span> {gpu.vendor}</p>
                <p><span className={styles.label}>Model:</span> {gpu.model}</p>
                {gpu.vram !== 'N/A' && <p><span className={styles.label}>VRAM:</span> {gpu.vram}</p>}
                {gpu.driverVersion !== 'N/A' && <p><span className={styles.label}>Driver:</span> {gpu.driverVersion}</p>}
                {displayMode === 'detailed' && (
                  <>
                    {gpu.bus !== 'N/A' && <p><span className={styles.label}>Bus:</span> {gpu.bus}</p>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.emptyMessage}>No graphics information available</p>
      )}
    </SectionContainer>
  );
};
