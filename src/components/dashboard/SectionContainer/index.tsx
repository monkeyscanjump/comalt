import React from 'react';
import { FiChevronDown, FiChevronUp, FiRefreshCw } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import styles from '@/app/page.module.css';
import { DisplayMode } from '@/types/dashboard';

interface SectionContainerProps {
  title: string;
  icon: IconType;
  isFullWidth?: boolean;
  isRefreshing?: boolean;
  canRefresh?: boolean;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  onRefresh?: () => void;
  onToggleCollapse?: () => void;
  children: React.ReactNode;
  className?: string;
  displayMode?: DisplayMode;
}

export const SectionContainer: React.FC<SectionContainerProps> = ({
  title,
  icon: Icon,
  isFullWidth = false,
  isRefreshing = false,
  canRefresh = false,
  isCollapsible = false,
  isCollapsed = false,
  onRefresh,
  onToggleCollapse,
  children,
  className = '',
  displayMode = 'default'
}) => {
  // Adapt view based on display mode
  const getCardClassName = () => {
    let baseClass = `${styles.card} ${isFullWidth ? styles.fullWidth : ''}`;

    if (displayMode === 'compact') {
      baseClass += ` ${styles.compactCard}`;
    } else if (displayMode === 'detailed') {
      baseClass += ` ${styles.detailedCard}`;
    }

    return `${baseClass} ${className}`;
  };

  return (
    <div className={getCardClassName()}>
      <h2 className={styles.cardTitle}>
        <Icon className={styles.cardIcon} />
        {title}

        <div className={styles.cardActions}>
          {/* Refresh button - shown only for components that can be refreshed */}
          {canRefresh && onRefresh && (
            <button
              className={styles.sectionRefreshButton}
              onClick={onRefresh}
              disabled={isRefreshing}
              title={`Refresh ${title.toLowerCase()} information`}
              aria-label={`Refresh ${title.toLowerCase()} information`}
            >
              <FiRefreshCw className={`${isRefreshing ? styles.spinning : ''}`} />
            </button>
          )}

          {/* Collapse/expand button - only shown if collapsible */}
          {isCollapsible && onToggleCollapse && (
            <button
              className={styles.collapseButton}
              onClick={onToggleCollapse}
              title={isCollapsed ? "Expand section" : "Collapse section"}
              aria-label={isCollapsed ? "Expand section" : "Collapse section"}
              aria-expanded={!isCollapsed}
            >
              {isCollapsed ? <FiChevronDown /> : <FiChevronUp />}
            </button>
          )}
        </div>
      </h2>

      {/* Content area - conditionally shown based on collapsed state */}
      {(!isCollapsible || !isCollapsed) && (
        <div className={`${styles.cardContent} ${isRefreshing ? styles.refreshing : ''}`}>
          {children}
        </div>
      )}
    </div>
  );
}
