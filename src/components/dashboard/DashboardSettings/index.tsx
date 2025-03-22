import React from 'react';
import {
  FiX,
  FiMaximize,
  FiMinimize,
  FiCheck,
  FiMonitor,
  FiClock,
  FiLayers,
  FiSettings
} from 'react-icons/fi';
import styles from './DashboardSettings.module.css';
import { DashboardSettingsProps, REFRESH_OPTIONS, SECTION_CONFIG, DisplayMode } from '@/types/dashboard';
import { SectionId } from '@/hooks/useCollapsibleSections';

export const DashboardSettings: React.FC<DashboardSettingsProps> = ({
  preferences,
  onUpdatePreference,
  onClose,
  onCollapseAll,
  onExpandAll
}) => {
  const handleDisplayModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdatePreference('displayMode', e.target.value as DisplayMode);
  };

  const handleAutoRefreshToggle = () => {
    onUpdatePreference('autoRefreshEnabled', !preferences.autoRefreshEnabled);
  };

  const handleRefreshIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdatePreference('autoRefreshInterval', parseInt(e.target.value, 10));
  };

  const handleSectionVisibilityChange = (sectionId: SectionId) => {
    onUpdatePreference('visibleSections', {
      ...preferences.visibleSections,
      [sectionId]: !preferences.visibleSections[sectionId]
    });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <FiSettings />
          Dashboard Settings
        </h3>
        <button
          onClick={onClose}
          className={styles.closeButton}
          aria-label="Close settings"
        >
          <FiX />
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <FiMonitor />
            Display
          </h4>

          <div className={styles.formGroup}>
            <label htmlFor="displayMode">Display Mode</label>
            <select
              id="displayMode"
              value={preferences.displayMode}
              onChange={handleDisplayModeChange}
              className={styles.select}
            >
              <option value="default">Default</option>
              <option value="compact">Compact</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>

          <div className={styles.buttonGroup}>
            <button
              onClick={onExpandAll}
              className={styles.button}
              title="Expand all sections"
            >
              <FiMaximize /> Expand All
            </button>
            <button
              onClick={onCollapseAll}
              className={styles.button}
              title="Collapse all sections"
            >
              <FiMinimize /> Collapse All
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <FiClock />
            Auto-Refresh
          </h4>

          <div
            className={`${styles.switchWrapper} ${preferences.autoRefreshEnabled ? styles.switchActive : ''}`}
            onClick={handleAutoRefreshToggle}
          >
            <div className={styles.switchTrack}>
              <div className={styles.switchThumb}></div>
            </div>
            <span className={styles.switchLabel}>
              {preferences.autoRefreshEnabled ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
            </span>
          </div>

          {preferences.autoRefreshEnabled && (
            <div className={styles.formGroup}>
              <label htmlFor="refreshInterval">Refresh Interval</label>
              <select
                id="refreshInterval"
                value={preferences.autoRefreshInterval}
                onChange={handleRefreshIntervalChange}
                className={styles.select}
              >
                {REFRESH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <FiLayers />
            Visible Sections
          </h4>

          <div className={styles.checkboxContainer}>
            {SECTION_CONFIG.map((section) => (
              <div
                key={section.id}
                className={`${styles.checkboxItem} ${preferences.visibleSections[section.id] ? styles.checked : ''}`}
                onClick={() => handleSectionVisibilityChange(section.id)}
              >
                <div className={styles.iconWrapper}>
                  {preferences.visibleSections[section.id] && <FiCheck size={12} />}
                </div>
                <span className={styles.checkboxLabel}>{section.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
