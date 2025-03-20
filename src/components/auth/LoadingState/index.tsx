import React from 'react';
import styles from '@/components/auth/AuthComponents.module.css';

interface LoadingStateProps {
  message?: string;
  showSpinner?: boolean;
}

export function LoadingState({ message = '', showSpinner = true }: LoadingStateProps) {
  return (
    <div className={styles.loadingContainer}>
      {showSpinner && (
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
        </div>
      )}
      {message && <p className={styles.loadingText}>{message}</p>}
    </div>
  );
}
