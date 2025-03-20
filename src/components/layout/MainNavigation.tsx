"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useNavigation } from '@/contexts/navigation/NavigationContext';
import styles from './MainNavigation.module.css';

export function MainNavigation() {
  const { routes, isRouteActive } = useNavigation();
  const [activeTabPosition, setActiveTabPosition] = useState({ left: 0, width: 0 });
  const navRef = useRef<HTMLElement>(null);
  const activeTabRef = useRef<HTMLAnchorElement>(null);

  // Update indicator position when active tab changes
  useEffect(() => {
    if (activeTabRef.current && navRef.current) {
      const tabRect = activeTabRef.current.getBoundingClientRect();
      const navRect = navRef.current.getBoundingClientRect();

      setActiveTabPosition({
        left: tabRect.left - navRect.left,
        width: tabRect.width
      });
    }
  }, [routes, isRouteActive]);

  // Filter and sort navigation items
  const navItems = routes
    .filter(route => route.showInNav)
    .sort((a, b) => a.order - b.order);

  if (navItems.length === 0) {
    return null;
  }

  return (
    <nav ref={navRef} className={styles.navContainer}>
      <div className={styles.tabsContainer}>
        {navItems.map(route => (
          <Link
            key={route.path}
            href={route.path}
            ref={isRouteActive(route.path) ? activeTabRef : null}
            className={`${styles.tab} ${isRouteActive(route.path) ? styles.activeTab : ''}`}
          >
            {route.icon && (
              <span className={styles.tabIcon}>
                <route.icon />
              </span>
            )}
            <span className={styles.tabText}>{route.title}</span>
          </Link>
        ))}

        {/* Animated indicator for active tab */}
        <div
          className={styles.activeIndicator}
          style={{
            transform: `translateX(${activeTabPosition.left}px)`,
            width: `${activeTabPosition.width}px`
          }}
        />
      </div>
    </nav>
  );
}
