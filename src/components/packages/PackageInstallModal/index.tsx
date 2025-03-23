import React, { useState } from 'react';
import { FiFolder, FiX, FiGithub, FiDownload } from 'react-icons/fi';
import styles from '@/app/page.module.css';
import modalStyles from './PackageInstallModal.module.css';
import { Package } from '@/types/packages';

interface PackageInstallModalProps {
  package: Package;
  onInstall: (pkg: Package, installPath: string) => void;
  onCancel: () => void;
}

export const PackageInstallModal: React.FC<PackageInstallModalProps> = ({
  package: pkg,
  onInstall,
  onCancel
}) => {
  const [installPath, setInstallPath] = useState(pkg.defaultInstallPath || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onInstall(pkg, installPath);
  };

  return (
    <div className={modalStyles.modalBackdrop}>
      <div className={modalStyles.modal}>
        <div className={modalStyles.modalHeader}>
          <h3 className={modalStyles.modalTitle}>Install {pkg.name}</h3>
          <button
            className={modalStyles.closeButton}
            onClick={onCancel}
            aria-label="Close"
          >
            <FiX />
          </button>
        </div>

        <div className={modalStyles.modalContent}>
          <p className={modalStyles.description}>{pkg.description}</p>

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

            {pkg.requirements && Object.keys(pkg.requirements).length > 0 && (
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

            <form onSubmit={handleSubmit}>
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
                  className={styles.buttonPrimary}
                >
                  <FiDownload className={styles.buttonIconLeft} />
                  Install
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
