"use client";

import React, { useEffect, useState, memo, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/auth';
import { MainNavigation } from '@/components/layout/MainNavigation';
import ThemeToggle from '@/components/layout/ThemeToggle';
import styles from './DynamicHeader.module.css';
import { useEnv } from '@/hooks/useEnv';

// Import WalletConnector with SSR disabled to prevent hydration errors
const WalletConnector = dynamic(
  () => import('@/components/wallet/WalletConnector').then(mod => mod.default || mod),
  { ssr: false }
);

// Add debugging to identify render causes
function DynamicHeaderComponent() {
  // Use refs to track renders and detect what's changing
  const renderCountRef = React.useRef(0);

  // Fix TypeScript error by using correct type
  const prevPropsRef = React.useRef<{ isPublicMode: boolean | null }>({
    isPublicMode: null
  });

  const [isClient, setIsClient] = useState(false);
  const { isPublicMode } = useAuth();
  const appName = useEnv('APP_NAME', 'comAlt');

  // Log renders in development only - add dependency array to prevent constant execution
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      renderCountRef.current += 1;
      console.log(`[DynamicHeader] Render #${renderCountRef.current}`);

      // Only log if isPublicMode has actually changed
      if (prevPropsRef.current.isPublicMode !== isPublicMode) {
        console.log(`[DynamicHeader] isPublicMode changed: ${prevPropsRef.current.isPublicMode} -> ${isPublicMode}`);
        prevPropsRef.current.isPublicMode = isPublicMode;
      }
    }
  }, [isPublicMode]); // Add dependency array to prevent re-running on every render

  // Only run once to set isClient
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Memoize the rendering of the WalletConnector to prevent re-renders
  const renderWalletConnector = useCallback(() => {
    return isClient && !isPublicMode ? <WalletConnector /> : null;
  }, [isClient, isPublicMode]);

  return (
    <header className={styles.headerContainer}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" className={styles.headerLogo}>{appName}</Link>
        </div>

        <MainNavigation />

        <div className={styles.headerRight}>
          <ThemeToggle className={styles.themeToggleHeader} />
          {renderWalletConnector()}
        </div>
      </div>
    </header>
  );
}

// Memoize the entire component to prevent unnecessary re-renders
export const DynamicHeader = memo(DynamicHeaderComponent);

export default DynamicHeader;
