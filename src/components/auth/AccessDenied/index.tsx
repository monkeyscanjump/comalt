import React from 'react';
import styles from '@/components/auth/AuthComponents.module.css';

interface AccessDeniedProps {
  walletAddress: string | null;
}

export function AccessDenied({ walletAddress }: AccessDeniedProps) {
  return (
    <div className={styles.accessDenied}>
      <h2>Access Denied</h2>
      <p>Your wallet address is not authorized to use this application.</p>
      <p className={styles.walletAddress}>
        Address: {walletAddress}
      </p>
    </div>
  );
}
