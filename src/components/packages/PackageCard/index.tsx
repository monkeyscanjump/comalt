import React from 'react';
import {
  FiGithub,
  FiDownload,
  FiTrash2,
  FiCheck,
  FiAlertTriangle,
  FiExternalLink,
  FiInfo
} from 'react-icons/fi';
import styles from './PackageCard.module.css';
import { Package, getCommandsAsArray } from '@/types/packages';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/layout/Badge';

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
  const isInProgress = isInstalling || isUninstalling;
  const commands = getCommandsAsArray(pkg.installCommands);

  // Format relative time for installed date
  const getFormattedDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return 'Unknown';
    }
  };

  // Safely handle opening file paths on different platforms
  const handleOpenPath = () => {
    if (!pkg.installPath) return;

    try {
      // Normalize path for display
      const displayPath = pkg.installPath.replace(/\\/g, '/');
      // Use file:// protocol which works in browser
      window.open(`file://${displayPath}`, '_blank');
    } catch (e) {
      console.error('Failed to open path:', e);
    }
  };

  return (
    <div className={styles.packageCard}>
      <div className={styles.cardHeader}>
        <h3>{pkg.name}</h3>
        <div className={styles.badges}>
          {pkg.category && (
            <Badge variant="outline" className={styles.categoryBadge}>
              {pkg.category}
            </Badge>
          )}
          {pkg.tags?.map(tag => (
            <Badge key={tag} variant="secondary" className={styles.tagBadge}>
              {tag}
            </Badge>
          ))}
          {pkg.isInstalled && (
            <Badge variant="success" className={styles.installedBadge}>
              <FiCheck className={styles.badgeIcon} />
              Installed
            </Badge>
          )}
        </div>
      </div>

      <p className={styles.description}>{pkg.description || 'No description available'}</p>

      <div className={styles.details}>
        {pkg.isInstalled && (
          <>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Version:</span>
              <span className={styles.detailValue}>{pkg.installedVersion || 'Unknown'}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Installed:</span>
              <span className={styles.detailValue}>
                {getFormattedDate(pkg.installedAt ?? null)}
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Path:</span>
              <span className={styles.detailValue}>
                <button
                  className={styles.pathButton}
                  onClick={handleOpenPath}
                >
                  {pkg.installPath} <FiExternalLink size={14} />
                </button>
              </span>
            </div>
            {pkg.lastError && (
              <div className={styles.errorContainer}>
                <FiAlertTriangle className={styles.errorIcon} />
                <span className={styles.errorMessage}>{pkg.lastError}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className={styles.githubInfo}>
        <a
          href={pkg.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.githubLink}
        >
          <FiGithub />
          View on GitHub
        </a>
      </div>

      <div className={styles.commandsContainer}>
        <h4 className={styles.commandsTitle}>
          <FiInfo className={styles.commandsIcon} />
          Installation Commands
        </h4>
        <div className={styles.commandsList}>
          {commands.map((cmd, index) => (
            <code key={index} className={styles.commandCode}>
              {cmd}
            </code>
          ))}
        </div>
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
