import React from 'react';
import { FiDownload, FiTrash2, FiGithub, FiTag, FiInfo } from 'react-icons/fi';
import styles from './PackageCard.module.css';
import { Package } from '@/types/packages';

// Local date formatting function
const formatDate = (date: Date): string => {
  // Format: "Jan 1, 2023"
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

interface PackageCardProps {
  package: Package;
  onInstall: (pkg: Package) => void;
  onUninstall: (pkg: Package) => void;
  isInstalling: boolean;
  isUninstalling: boolean;
}

export const PackageCard: React.FC<PackageCardProps> = ({
  package: pkg,
  onInstall,
  onUninstall,
  isInstalling,
  isUninstalling
}) => {
  // Check if there's an installation or uninstallation in progress
  const isInProgress = isInstalling || isUninstalling;

  return (
    <div className={`${styles.packageCard} ${pkg.isInstalled ? styles.installed : ''}`}>
      <div className={styles.cardHeader}>
        <h3>{pkg.name}</h3>
        {pkg.isInstalled && (
          <div className={styles.badges}>
            <span className={styles.installedBadge}>
              <span className={styles.badgeIcon}>✓</span>
              Installed
            </span>
          </div>
        )}
      </div>

      <p className={styles.description}>{pkg.description}</p>

      <div className={styles.badges}>
        {pkg.category && (
          <div className={styles.categoryBadge}>
            <FiInfo className={styles.badgeIcon} />
            {pkg.category}
          </div>
        )}
        {pkg.tags && pkg.tags.map(tag => (
          <div key={tag} className={styles.tagBadge}>
            <FiTag className={styles.badgeIcon} />
            {tag}
          </div>
        ))}
      </div>

      {pkg.isInstalled && (
        <div className={styles.details}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Version:</span>
            <span className={styles.detailValue}>{pkg.installedVersion || 'Unknown'}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Installed:</span>
            <span className={styles.detailValue}>
              {pkg.installedAt ? formatDate(new Date(pkg.installedAt)) : 'Unknown'}
            </span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Path:</span>
            <span className={styles.detailValue} title={pkg.installPath || ''}>
              {pkg.installPath ?
                (pkg.installPath.length > 25 ?
                  `...${pkg.installPath.substring(pkg.installPath.length - 25)}` :
                  pkg.installPath) :
                'Unknown'}
            </span>
          </div>
        </div>
      )}

      {pkg.lastError && (
        <div className={styles.errorContainer}>
          <FiInfo className={styles.errorIcon} />
          <span className={styles.errorMessage}>{pkg.lastError}</span>
        </div>
      )}

      <div className={styles.githubInfo}>
        <a
          href={pkg.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.githubLink}
          onClick={(e) => e.stopPropagation()}
        >
          <FiGithub />
          {pkg.githubUrl.replace('https://github.com/', '')}
        </a>
      </div>

      <div className={styles.actions}>
        {pkg.isInstalled ? (
          <button
            className={`${styles.button} ${styles.uninstallButton}`}
            onClick={() => onUninstall(pkg)}
            disabled={isInProgress}
          >
            {isUninstalling ? (
              <>
                <span className={styles.spinnerIcon}></span>
                Uninstalling...
              </>
            ) : (
              <>
                <FiTrash2 className={styles.buttonIcon} />
                Uninstall
              </>
            )}
          </button>
        ) : (
          <button
            className={`${styles.button} ${styles.installButton}`}
            onClick={() => onInstall(pkg)}
            disabled={isInProgress}
          >
            {isInstalling ? (
              <>
                <span className={styles.spinnerIcon}></span>
                Installing...
              </>
            ) : (
              <>
                <FiDownload className={styles.buttonIcon} />
                Install
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
