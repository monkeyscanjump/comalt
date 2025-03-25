"use client";

import React, { useEffect, useState } from 'react';
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

export function DynamicHeader() {
  const [isClient, setIsClient] = useState(false);
  const { isPublicMode } = useAuth();

  const appName = useEnv('APP_NAME', 'comAlt');

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <header className={styles.headerContainer}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" className={styles.headerLogo}>{appName}</Link>
        </div>

        <MainNavigation />

        <div className={styles.headerRight}>
          <ThemeToggle className={styles.themeToggleHeader} />
          {isClient && !isPublicMode && <WalletConnector />}
        </div>
      </div>
    </header>
  );
}

export default DynamicHeader;
