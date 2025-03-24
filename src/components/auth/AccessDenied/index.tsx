import React from 'react';
import styles from '@/components/auth/AuthComponents.module.css';
import { FaLock, FaTimes } from 'react-icons/fa';

interface AccessDeniedProps {
  walletAddress: string | null;
}

export function AccessDenied({ walletAddress }: AccessDeniedProps) {
  return (
    <div className={styles.authContainer}>
      <div className={styles.accessDeniedIcon}>
        <FaTimes className={styles.errorIcon} />
      </div>

      <h2 className={styles.authTitle}>
        <FaLock className={styles.titleIcon} />
        Access Denied
      </h2>

      <p className={styles.authDescription}>
        Your wallet address is not authorized to use this application.
      </p>

      <p className={styles.walletAddress}>
        Address: {walletAddress}
      </p>
    </div>
  );
}
