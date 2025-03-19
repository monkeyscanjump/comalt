"use client";

import React, { useState, useEffect } from 'react';
import { hasWhitelistedAddressesAsync } from '@/config/whitelist';
import styles from './AdminWarnings.module.css';

/**
 * Component to display important warnings to administrators
 * Only shown in development mode or to admin users
 */
const AdminWarnings: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => {
  const [hasWhitelist, setHasWhitelist] = useState(true);
  const [addressCount, setAddressCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' && !isAdmin) {
      setLoading(false);
      return;
    }
    const checkWhitelist = async () => {
      try {
        // Check whitelist status
        const hasAddresses = await hasWhitelistedAddressesAsync();
        setHasWhitelist(hasAddresses);

        // For dev mode, fetch address count
        if (process.env.NODE_ENV === 'development') {
          const response = await fetch('/api/auth/check-mode');
          const data = await response.json();
          setAddressCount(data.addressCount || 0);
        }
      } catch (error) {
        console.error('Error checking whitelist:', error);
      } finally {
        setLoading(false);
      }
    };

    checkWhitelist();
  }, [isAdmin]);

  if (loading) return null;
  if (loading || (process.env.NODE_ENV !== 'development' && !isAdmin)) return null;
  return (
    <div>
      {!hasWhitelist && (
        <div className={styles.warning}>
          <h3 className={styles.header}>⚠️ Public Mode Active</h3>
          <p className={styles.paragraph}>
            No wallet addresses are configured in the whitelist. The application is running in public mode.
          </p>
          <p className={styles.paragraph}>
            To enable authentication, set the <span className={styles.code}>ALLOWED_WALLETS</span> environment variable
            with a comma-separated list of wallet addresses.
          </p>
        </div>
      )}

      {process.env.NODE_ENV === 'development' && (
        <div className={styles.infoWarning}>
          <h3 className={styles.header}>ℹ️ Development Mode</h3>
          <p className={styles.paragraph}>
            You're running in development mode. Current whitelist configuration:
          </p>
          <div className={styles.addressList}>
            {addressCount > 0 ? (
              <p>{addressCount} address(es) configured</p>
            ) : (
              <p>No addresses configured</p>
            )}
            <p className={styles.securityNote}>
              Note: For security, the actual whitelist addresses are only available on the server.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminWarnings;
