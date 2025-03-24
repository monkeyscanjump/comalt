import React, { useState } from 'react';
import { FiFolder, FiX, FiGithub, FiDownload, FiTrash2, FiAlertTriangle } from 'react-icons/fi';
import styles from '@/app/page.module.css';
import modalStyles from './PackageInstallModal.module.css';
import { Package } from '@/types/packages';

type ModalMode = 'install' | 'uninstall';

interface PackageInstallModalProps {
  package: Package;
  mode?: ModalMode;
  onInstall?: (pkg: Package, installPath: string) => void;
  onUninstall?: (pkg: Package) => void;
  onCancel: () => void;
}

export const PackageInstallModal: React.FC<PackageInstallModalProps> = ({
  package: pkg,
  mode = 'install',
  onInstall,
  onUninstall,
  onCancel
}) => {
  const [installPath, setInstallPath] = useState(pkg.defaultInstallPath || '');
  const [error, setError] = useState<string | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'install') {
      // Validate path for installation
      if (!installPath || installPath.trim() === '') {
        setError('Please enter a valid installation path');
        return;
      }

      // Check for risky paths
      const riskyPaths = ['/', 'C:\\', 'C:/', '/usr', '/bin', '/etc'];
      if (riskyPaths.includes(installPath.trim())) {
        setError('Please choose a more specific installation path');
        return;
      }

      setError(null);
      onInstall?.(pkg, installPath);
    } else if (mode === 'uninstall') {
      // For uninstall, we need confirmation
      if (!confirmUninstall) {
        setConfirmUninstall(true);
        return;
      }

      onUninstall?.(pkg);
    }
  };

  const isInstallMode = mode === 'install';
  const modalTitle = isInstallMode ? `Install ${pkg.name}` : `Uninstall ${pkg.name}`;
  const buttonIcon = isInstallMode ? <FiDownload className={styles.buttonIconLeft} /> : <FiTrash2 className={styles.buttonIconLeft} />;
  const buttonText = isInstallMode ? 'Install' : confirmUninstall ? 'Confirm Uninstall' : 'Uninstall';
  const buttonClass = isInstallMode ? styles.buttonPrimary : styles.buttonDanger || styles.buttonWarning;

  return (
    <div className={modalStyles.modalBackdrop}>
      <div className={modalStyles.modal}>
        <div className={modalStyles.modalHeader}>
          <h3 className={modalStyles.modalTitle}>{modalTitle}</h3>
          <button
            className={modalStyles.closeButton}
            onClick={onCancel}
            aria-label="Close"
          >
            <FiX />
          </button>
        </div>

        <div className={modalStyles.modalContent}>
          <p className={modalStyles.description}>
            {pkg.description}
          </p>

          <div className={modalStyles.packageInfo}>
            <div className={modalStyles.infoItem}>
              <FiGithub />
              <a
                href={pkg.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {pkg.githubUrl.replace('https://github.com/', '')}
              </a>
            </div>

            {/* Show requirements only in install mode */}
            {isInstallMode && pkg.requirements && Object.keys(pkg.requirements).length > 0 && (
              <div className={modalStyles.requirements}>
                <h4>Requirements</h4>
                <ul>
                  {Object.entries(pkg.requirements).map(([name, version]) => (
                    <li key={name}>
                      {name}: {version}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Show uninstall warning in uninstall mode */}
            {mode === 'uninstall' && (
              <div className={modalStyles.warningMessage}>
                <FiAlertTriangle className={modalStyles.warningIcon} />
                <div>
                  {confirmUninstall ? (
                    <strong>Are you sure you want to uninstall {pkg.name}?</strong>
                  ) : (
                    <p>This will remove the package and delete all associated files from:</p>
                  )}

                  {pkg.installPath && (
                    <div className={modalStyles.pathDisplay}>
                      <code>{pkg.installPath}</code>
                    </div>
                  )}

                  {confirmUninstall && (
                    <p><strong>This action cannot be undone.</strong></p>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className={modalStyles.errorMessage}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Show path input only in install mode */}
              {isInstallMode && (
                <div className={modalStyles.formGroup}>
                  <label htmlFor="installPath">Installation Path</label>
                  <div className={modalStyles.inputWithIcon}>
                    <FiFolder className={modalStyles.inputIcon} />
                    <input
                      id="installPath"
                      type="text"
                      value={installPath}
                      onChange={(e) => setInstallPath(e.target.value)}
                      required
                      className={modalStyles.input}
                      placeholder="Enter installation path"
                    />
                  </div>
                </div>
              )}

              <div className={modalStyles.modalActions}>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={onCancel}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={buttonClass}
                >
                  {buttonIcon}
                  {buttonText}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
