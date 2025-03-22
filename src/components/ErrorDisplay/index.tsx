import React from 'react';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import styles from '@/app/page.module.css';

interface ErrorDisplayProps {
  error: string | Error;
  onRetry?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onRetry }) => {
  const errorMessage = typeof error === 'string' ? error : error.message;

  return (
    <div className={styles.container}>
      <div className={styles.errorContainer}>
        <h2 className={styles.errorTitle}>
          <FiAlertTriangle className={styles.errorIcon} />
          Error
        </h2>
        <p className={styles.errorMessage}>{errorMessage}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className={styles.button}
            title="Retry operation"
          >
            <FiRefreshCw className={styles.buttonIcon} />
            Retry
          </button>
        )}
      </div>
    </div>
  );
};
