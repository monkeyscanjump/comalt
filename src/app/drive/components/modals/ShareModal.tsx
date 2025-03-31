import React from 'react';
import { FiX, FiClipboard, FiCheck, FiLink } from 'react-icons/fi';
import styles from '../../drive.module.css';
import pageStyles from '@/styles/pages.module.css';

interface ShareModalProps {
  isOpen: boolean;
  isSharing: boolean;
  publicUrl: string | null;
  copied: boolean;
  onClose: () => void;
  onCopy: (url: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  isSharing,
  publicUrl,
  copied,
  onClose,
  onCopy
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Share File</h3>
          <button
            onClick={onClose}
            className={styles.closeButton}
          >
            <FiX />
          </button>
        </div>

        <div className={styles.modalContent}>
          {isSharing ? (
            <div className={styles.sharingStatus}>
              <p>Creating shareable link...</p>
            </div>
          ) : publicUrl ? (
            <div className={styles.publicUrlContainer}>
              <p className={styles.shareMessage}>
                <FiLink className={styles.shareIcon} />
                Your file is now publicly accessible via this link:
              </p>
              <div className={styles.urlContainer}>
                <input
                  type="text"
                  value={publicUrl}
                  readOnly
                  className={styles.publicUrlInput}
                />
                <button
                  onClick={() => onCopy(publicUrl)}
                  className={pageStyles.buttonSecondary}
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <>
                      <FiCheck className={pageStyles.buttonIconLeft} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <FiClipboard className={pageStyles.buttonIconLeft} />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <p className={styles.publicNoteText}>
                Anyone with this link can access your file.
              </p>
            </div>
          ) : (
            <div className={styles.shareError}>
              <p>Failed to create shareable link. Please try again.</p>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button
            onClick={onClose}
            className={pageStyles.buttonSecondary}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
