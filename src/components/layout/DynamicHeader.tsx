"use client";

import React from 'react';
import Image from 'next/image';
import { useNavigation } from '@/contexts/navigation/NavigationContext';
import { useAuth } from '@/contexts/auth';
import WalletConnector from '@/components/wallet/WalletConnector';
import styles from './DynamicHeader.module.css';

export function DynamicHeader() {
  const { routes, isRouteActive } = useNavigation();
  const { isPublicMode } = useAuth();

  // Filter routes to only show those with showInNav=true
  const navItems = routes.filter(route => route.showInNav);

  // Use window.location directly - this bypasses ALL interference
  function forceNavigate(path: string) {
    console.log(`Forcing navigation to: ${path}`);
    window.location.href = path;
  }

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        {/* Use button instead of a tag for more reliable behavior */}
        <button
          className={styles.headerLogoButton}
          onClick={() => forceNavigate('/')}
        >
          <Image
            src="/logo.svg"
            alt="comalt"
            width={180}
            height={40}
            priority
          />
        </button>
      </div>

      <nav className={styles.navigation}>
        <ul className={styles.navList}>
          {navItems.map((route) => {
            const IconComponent = route.icon;
            const isActive = isRouteActive(route.path);

            return (
              <li key={route.path} className={styles.navItem}>
                {/* Use button instead of a tag for more reliable behavior */}
                <button
                  className={`${styles.navButton} ${isActive ? styles.active : ''}`}
                  onClick={() => forceNavigate(route.path)}
                >
                  {IconComponent && <IconComponent className={styles.navIcon} />}
                  <span>{route.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.headerRight}>
        {!isPublicMode && <WalletConnector />}
      </div>
    </header>
  );
}
