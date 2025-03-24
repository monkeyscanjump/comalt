import React from 'react';
import styles from './LoadingState.module.css';

interface LoadingStateProps {
  message?: string;
  showSpinner?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function LoadingState({
  message = 'Loading...',
  showSpinner = true,
  size = 'medium'
}: LoadingStateProps) {
  return (
    <div className={`${styles.loadingContainer} ${styles[`size${size.charAt(0).toUpperCase()}${size.slice(1)}`]}`}>
      {showSpinner && (
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}>
            <div className={styles.arc1}></div>
            <div className={styles.arc2}></div>
            <div className={styles.arc3}></div>
          </div>
        </div>
      )}
      {message && <p className={styles.loadingText}>{message}</p>}
    </div>
  );
}
