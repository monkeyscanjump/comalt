import React from 'react';
import { FiDatabase } from 'react-icons/fi';
import { SectionContainer } from '@/components/dashboard/SectionContainer';
import styles from '@/app/page.module.css';
import type { SystemMemory } from '@/types/systemInfo';
import type { BaseSectionProps } from '@/types/dashboard';

interface MemorySectionProps extends BaseSectionProps {
  memory: SystemMemory | undefined;
}

export const MemorySection: React.FC<MemorySectionProps> = ({
  memory,
  isRefreshing = false,
  onRefresh,
  displayMode,
  className
}) => {
  return (
    <SectionContainer
      title="Memory"
      icon={FiDatabase}
      isRefreshing={isRefreshing}
      canRefresh={!!onRefresh}
      onRefresh={onRefresh}
      displayMode={displayMode}
      className={className}
    >
      {memory ? (
        <div className={styles.memoryInfo}>
          {displayMode === 'compact' ? (
            // Compact display
            <p className={styles.compactContent}>
              Used: {memory.used} ({memory.percentUsed}) of {memory.total}
            </p>
          ) : (
            // Default/detailed display
            <>
              <div className={styles.memoryBar}>
                <div
                  className={styles.memoryUsed}
                  style={{ width: memory.percentUsed }}
                  title={`${memory.used} (${memory.percentUsed})`}
                />
              </div>
              <p><span className={styles.label}>Total:</span> {memory.total}</p>
              <p><span className={styles.label}>Used:</span> {memory.used} ({memory.percentUsed})</p>
              <p><span className={styles.label}>Free:</span> {memory.free}</p>
            </>
          )}
        </div>
      ) : (
        <p className={styles.emptyMessage}>No memory information available</p>
      )}
    </SectionContainer>
  );
};
