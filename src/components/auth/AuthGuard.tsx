"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { LoadingState } from './LoadingState';
import { ConnectWallet } from './ConnectWallet';
import { AccessDenied } from './AccessDenied';
import { SignatureRequest } from './SignatureRequest';
import { usePathname } from 'next/navigation';
import { config } from '@/config';

/**
 * AuthGuard component controls access to protected content based on authentication state.
 * Handles public mode, loading states, and the authentication flow.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  // Client-side rendering guard
  const [isMounted, setIsMounted] = useState(false);
  // Content visibility control
  const [shouldShowContent, setShouldShowContent] = useState(false);

  const {
    isAuthenticated,
    isLoading,
    isAllowed,
    isWalletConnected,
    walletAddress,
    wasSignatureRejected,
    isPublicMode
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
        shouldShowContent
      });
    }
  }, [isAuthenticated, isAllowed, isPublicMode, pathname, shouldShowContent]);

  /**
   * During server-side rendering, we need to render a skeleton or loading state
   * to avoid content flash
   */
  if (!isMounted) {
    return <div className="auth-loading-container"><LoadingState /></div>;
  }

  /**
   * Client-side authentication flow starts here
   */

  // Allow immediate access in public mode
  if (isPublicMode) {
    return <>{children}</>;
  }

  // Show loading state while authenticating
  if (isLoading) {
    return <LoadingState />;
  }

  // Authentication flow for non-public mode
  if (!isWalletConnected) {
    return <ConnectWallet showTitle={true} />;
  }

  if (isWalletConnected && !isAllowed) {
    return <AccessDenied walletAddress={walletAddress} />;
  }

  if (isWalletConnected && isAllowed && !isAuthenticated) {
    return <SignatureRequest wasRejected={wasSignatureRejected} />;
  }

  if (isAuthenticated && isAllowed) {
    return <>{children}</>;
  }

  // Fallback
  return <ConnectWallet showTitle={false} />;
}
