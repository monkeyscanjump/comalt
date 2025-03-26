"use client";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/auth';
import styles from '@/components/auth/AuthComponents.module.css';
import { FiAlertTriangle, FiRefreshCw, FiLogOut } from 'react-icons/fi';

export function TokenExpired() {
  const { refreshAuthToken, logout, walletAddress } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [refreshAttempts, setRefreshAttempts] = useState(0);

  /**
   * Handle token refresh
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    setRefreshSuccess(false);

    console.log("Starting token refresh...");

    try {
      // Increment attempt counter
      setRefreshAttempts(prev => prev + 1);

      // Attempt to refresh the token
      const success = await refreshAuthToken();
      console.log("Token refresh result:", success);

      if (success) {
        setRefreshSuccess(true);
        // Redirect or refresh after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setRefreshError("Couldn't refresh your session. Please try logging in again.");
      }
    } catch (error) {
      console.error("Token refresh error:", error);
      setRefreshError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while refreshing your session."
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  /**
   * Handle logout and restart authentication
   */
  const handleLogout = () => {
    logout();
  };

  // If multiple refresh attempts failed, show stronger messaging
  const showLogoutPreference = refreshAttempts >= 2;

  return (
    <div className={styles.authContainer}>
      <h2 className={styles.authTitle}>
        <FiAlertTriangle className={styles.titleIcon} />
        Session Expired
      </h2>

      <p className={styles.authDescription}>
        Your authentication session has expired. This can happen if you've been inactive
        for a while or if your wallet status has changed.
      </p>

      {walletAddress && (
        <div className={styles.walletAddress}>
          {walletAddress}
        </div>
      )}

      {refreshError && (
        <div className={styles.errorMessage}>
          <p className={styles.errorText}>{refreshError}</p>
        </div>
      )}

      {refreshSuccess && (
        <div className={styles.successMessage}>
          <p>Session refreshed successfully! Redirecting...</p>
        </div>
      )}

      <div style={{ width: '100%', marginTop: 'var(--space-md)' }}>
        {showLogoutPreference ? (
          <>
            <button
              className={styles.primaryButton}
              onClick={handleLogout}
              disabled={isRefreshing || refreshSuccess}
              style={{ width: '100%', marginBottom: 'var(--space-sm)' }}
            >
              <FiLogOut className={styles.buttonIcon} />
              Log Out &amp; Reconnect
            </button>

            <button
              className={styles.primaryButton}
              onClick={handleRefresh}
              disabled={isRefreshing || refreshSuccess}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)'
              }}
            >
              <FiRefreshCw className={isRefreshing ? styles.spinIcon : styles.buttonIcon} />
              Try Refreshing Again
            </button>
          </>
        ) : (
          <>
            <button
              className={styles.primaryButton}
              onClick={handleRefresh}
              disabled={isRefreshing || refreshSuccess}
              style={{ width: '100%', marginBottom: 'var(--space-sm)' }}
            >
              <FiRefreshCw className={isRefreshing ? styles.spinIcon : styles.buttonIcon} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Token'}
            </button>

            <button
              className={styles.primaryButton}
              onClick={handleLogout}
              disabled={isRefreshing || refreshSuccess}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)'
              }}
            >
              <FiLogOut className={styles.buttonIcon} />
              Log Out
            </button>
          </>
        )}
      </div>
    </div>
  );
}
