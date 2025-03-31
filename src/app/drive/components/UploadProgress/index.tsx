import React from 'react';
import styles from './UploadProgress.module.css';

interface UploadProgressProps {
  progress: {
    current: number;
    total: number;
    message: string;
  };
}

export const UploadProgress: React.FC<UploadProgressProps> = ({ progress }) => {
  const { current, total, message } = progress;

  // Calculate percentage, assume 0-100 for single file
  const percentage = Math.min(100, Math.max(0, current));

  return (
    <div className={styles.progressContainer}>
      <div className={styles.progressDetails}>
        <p className={styles.progressMessage}>{message}</p>
        <div className={styles.progressBar}>
          <div
            className={styles.progressBarInner}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className={styles.progressInfo}>
          <span className={styles.progressStatus}>
            {percentage}% complete
          </span>
        </div>
      </div>
    </div>
  );
};
