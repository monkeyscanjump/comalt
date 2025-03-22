import React, { useState, useMemo } from 'react';
import { FiActivity, FiArrowDown, FiArrowUp } from 'react-icons/fi';
import { SectionContainer } from '@/components/dashboard/SectionContainer';
import styles from '@/app/page.module.css';
import type { SystemProcess } from '@/types/systemInfo';
import type { BaseSectionProps } from '@/types/dashboard';

interface ProcessesSectionProps extends BaseSectionProps {
  processes: SystemProcess[] | undefined;
}

type SortField = 'name' | 'pid' | 'status' | 'cpu' | 'memory' | 'uptime' | 'restarts';
type SortDirection = 'asc' | 'desc';

export const ProcessesSection: React.FC<ProcessesSectionProps> = ({
  processes,
  isRefreshing = false,
  isCollapsed = false,
  onRefresh,
  onToggleCollapse,
  displayMode,
  className
}) => {
  // State for sorting
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Sorted processes
  const sortedProcesses = useMemo(() => {
    if (!processes) return [];

    return [...processes].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'pid':
          comparison = a.pid - b.pid;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'cpu':
          comparison = parseFloat(a.cpu.replace('%', '')) - parseFloat(b.cpu.replace('%', ''));
          break;
        case 'memory':
          comparison = parseFloat(a.memory.replace(/[^0-9.]/g, '')) - parseFloat(b.memory.replace(/[^0-9.]/g, ''));
          break;
        case 'uptime':
          // Simple string comparison
          comparison = a.uptime.localeCompare(b.uptime);
          break;
        case 'restarts':
          comparison = (a.restarts || 0) - (b.restarts || 0);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [processes, sortField, sortDirection]);

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get sort indicator for column header
  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <FiArrowUp /> : <FiArrowDown />;
  };

  // For compact display, just show a summary
  if (displayMode === 'compact' && processes && processes.length > 0) {
    const runningCount = processes.filter(p => p.status === 'online').length;

    return (
      <SectionContainer
        title="PM2 Processes"
        icon={FiActivity}
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
          {runningCount} running of {processes.length} process{processes.length !== 1 ? 'es' : ''}
        </p>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer
      title="PM2 Processes"
      icon={FiActivity}
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
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th
                className={`${styles.tableHeader} ${styles.sortable}`}
                onClick={() => handleSort('name')}
              >
                Name {getSortIndicator('name')}
              </th>
              <th
                className={`${styles.tableHeader} ${styles.sortable}`}
                onClick={() => handleSort('pid')}
              >
                PID {getSortIndicator('pid')}
              </th>
              <th
                className={`${styles.tableHeader} ${styles.sortable}`}
                onClick={() => handleSort('status')}
              >
                Status {getSortIndicator('status')}
              </th>
              <th
                className={`${styles.tableHeader} ${styles.sortable}`}
                onClick={() => handleSort('cpu')}
              >
                CPU {getSortIndicator('cpu')}
              </th>
              <th
                className={`${styles.tableHeader} ${styles.sortable}`}
                onClick={() => handleSort('memory')}
              >
                Memory {getSortIndicator('memory')}
              </th>
              <th
                className={`${styles.tableHeader} ${styles.sortable}`}
                onClick={() => handleSort('uptime')}
              >
                Uptime {getSortIndicator('uptime')}
              </th>
              {displayMode === 'detailed' && (
                <th
                  className={`${styles.tableHeader} ${styles.sortable}`}
                  onClick={() => handleSort('restarts')}
                >
                  Restarts {getSortIndicator('restarts')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedProcesses.length > 0 ? (
              sortedProcesses.map((process, index) => (
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
                  {displayMode === 'detailed' && (
                    <td className={styles.tableCell}>{process.restarts || 0}</td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={displayMode === 'detailed' ? 7 : 6}
                  className={styles.tableCell}
                >
                  No process information available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionContainer>
  );
};
