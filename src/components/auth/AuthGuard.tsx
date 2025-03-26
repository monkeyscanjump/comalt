"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { LoadingState } from '@/components/LoadingState';
import { ConnectWallet } from '@/components/auth/ConnectWallet';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { SignatureRequest } from '@/components/auth/SignatureRequest';
import { TokenExpired } from '@/components/auth/TokenExpired';
import { usePathname } from 'next/navigation';
import { config } from '@/config';
import styles from './AuthComponents.module.css';

// Maximum time to wait before showing recovery options
const MAX_ALLOWLIST_CHECK_TIME = 7000; // 7 seconds

/**
 * AuthGuard component controls access to protected content based on authentication state.
 * Handles public mode, loading states, and the authentication flow.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  // Client-side rendering guard
  const [isMounted, setIsMounted] = useState(false);
  // Content visibility control
  const [shouldShowContent, setShouldShowContent] = useState(false);
  // Allowlist check monitoring
  const [allowlistCheckStartTime, setAllowlistCheckStartTime] = useState<number | null>(null);
  const [isAllowlistCheckStalled, setIsAllowlistCheckStalled] = useState(false);

  const {
    isAuthenticated,
    isLoading,
    isAllowed,
    isWalletConnected,
    walletAddress,
    wasSignatureRejected,
    isPublicMode,
    isCheckingAllowlist,
    isTokenExpired,
    logout
  } = useAuth();

  const pathname = usePathname();

  /**
   * Set mounted state after hydration is complete
   */
  useEffect(() => {
    setIsMounted(true);

    // Check if we have auth info in localStorage to decide initial visibility
    if (typeof window !== 'undefined') {
      const hasStoredAuth = localStorage.getItem(config.auth.tokenName) !== null;
      const isPublic = localStorage.getItem(config.auth.publicModeFlag) === 'true';

      // Only show content initially if we have stored auth or in public mode
      setShouldShowContent(hasStoredAuth || isPublic);
    }
  }, []);

  /**
   * Track allowlist check start time
   */
  useEffect(() => {
    if (isCheckingAllowlist && !allowlistCheckStartTime) {
      setAllowlistCheckStartTime(Date.now());
      setIsAllowlistCheckStalled(false);
    } else if (!isCheckingAllowlist && allowlistCheckStartTime) {
      setAllowlistCheckStartTime(null);
      setIsAllowlistCheckStalled(false);
    }
  }, [isCheckingAllowlist, allowlistCheckStartTime]);

  /**
   * Monitor allowlist check duration and detect if it stalls
   */
  useEffect(() => {
    if (!allowlistCheckStartTime) return;

    const checkTimerId = setInterval(() => {
      const elapsedTime = Date.now() - allowlistCheckStartTime;
      if (elapsedTime > MAX_ALLOWLIST_CHECK_TIME && isCheckingAllowlist) {
        console.warn(`Allowlist check exceeded ${MAX_ALLOWLIST_CHECK_TIME}ms, marking as stalled`);
        setIsAllowlistCheckStalled(true);

        // If user is authenticated, auto-recover after some time
        const hasToken = localStorage.getItem(config.auth.tokenName);
        if (hasToken && elapsedTime > MAX_ALLOWLIST_CHECK_TIME + 5000) {
          console.info('Authenticated user stuck - forcing page reload');
          window.location.reload();
        }
      }
    }, 1000);

    return () => clearInterval(checkTimerId);
  }, [allowlistCheckStartTime, isCheckingAllowlist]);

  /**
   * Update content visibility based on authentication state
   */
  useEffect(() => {
    if (isMounted) {
      // Save public mode state for initial load decisions
      if (typeof window !== 'undefined') {
        localStorage.setItem(config.auth.publicModeFlag, String(isPublicMode));
      }

      // Show content when authenticated or in public mode
      setShouldShowContent(isAuthenticated || isPublicMode);
    }
  }, [isAuthenticated, isPublicMode, isMounted]);

  /**
   * Debug logging for authentication state
   */
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`Auth state (${pathname}):`, {
        authenticated: isAuthenticated,
        allowed: isAllowed,
        public: isPublicMode,
        shouldShowContent,
        isCheckingAllowlist,
        checkStartTime: allowlistCheckStartTime,
        isStalled: isAllowlistCheckStalled
      });
    }
  }, [
    isAuthenticated,
    isAllowed,
    isPublicMode,
    pathname,
    shouldShowContent,
    isCheckingAllowlist,
    allowlistCheckStartTime,
    isAllowlistCheckStalled
  ]);

  /**
   * During server-side rendering, we need to render a skeleton or loading state
   * to avoid content flash
   */
  if (!isMounted) {
    return (
      <div className={styles.authPageContainer}>
        <div className={styles.loadingContainer}>
          <LoadingState />
        </div>
      </div>
    );
  }

  // Show loading state while authenticating
  if (isLoading) {
    return (
      <div className={styles.authPageContainer}>
        <div className={styles.loadingContainer}>
          <LoadingState />
        </div>
      </div>
    );
  }

  // Show token expired message
  if (isTokenExpired) {
    return (
      <div className={styles.authPageContainer}>
        <TokenExpired />
      </div>
    );
  }

  // Allow immediate access in public mode
  if (isPublicMode) {
    return <>{children}</>;
  }

  // Authentication flow for non-public mode
  if (!isWalletConnected) {
    return (
      <div className={styles.authPageContainer}>
        <ConnectWallet showTitle={true} />
      </div>
    );
  }

  // Show loading state while checking allowlist
  if (isWalletConnected && isCheckingAllowlist) {
    return (
      <div className={styles.authPageContainer}>
        <div className={styles.loadingContainer}>
          <LoadingState message="Checking wallet permissions..." />

          {isAllowlistCheckStalled && (
            <div className={styles.retryContainer}>
              <p className={styles.retryText}>
                This is taking longer than expected.
              </p>
              <div className={styles.retryButtonGroup}>
                <button
                  className={styles.retryButton}
                  onClick={() => {
                    // Force reload the page
                    window.location.reload();
                  }}
                >
                  Refresh Page
                </button>
                <button
                  className={`${styles.retryButton} ${styles.retryButtonSecondary}`}
                  onClick={() => {
                    // Restart auth completely
                    logout();
                    setTimeout(() => {
                      window.location.reload();
                    }, 100);
                  }}
                >
                  Restart Authentication
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isWalletConnected && !isAllowed) {
    return (
      <div className={styles.authPageContainer}>
        <AccessDenied walletAddress={walletAddress} />
      </div>
    );
  }

  if (isWalletConnected && isAllowed && !isAuthenticated) {
    return (
      <div className={styles.authPageContainer}>
        <SignatureRequest wasRejected={wasSignatureRejected} />
      </div>
    );
  }

  if (isAuthenticated && isAllowed) {
    return <>{children}</>;
  }

  // Fallback
  return (
    <div className={styles.authPageContainer}>
      <ConnectWallet showTitle={false} />
    </div>
  );
}
