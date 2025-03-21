import React from 'react';
import styles from './LoadingState.module.css';

interface LoadingStateProps {
  message?: string;
  showSpinner?: boolean;
}

export function LoadingState({ message = 'Loading...', showSpinner = true }: LoadingStateProps) {
  return (
    <div className={styles.loadingContainer}>
      {showSpinner && (
        <div className={styles.loadingSpinner}>
          {/* Two half circles that spin and change color */}
          <div className={styles.halfCircle}></div>
          <div className={styles.halfCircle}></div>
        </div>
      )}
      {message && <p className={styles.loadingText}>{message}</p>}
    </div>
  );
}
