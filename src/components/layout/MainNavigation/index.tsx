"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useNavigation } from '@/contexts/navigation/NavigationContext';
import { FiMoreHorizontal, FiChevronDown } from 'react-icons/fi';
import styles from './MainNavigation.module.css';

// Type guard function to check if route has a badge property
function hasBadge(route: any): route is { badge: number } {
  return route && typeof route.badge === 'number' && route.badge > 0;
}

// Helper function to check if route has an icon component
function hasIcon(route: any): boolean {
  return route && typeof route.icon !== 'undefined';
}

export function MainNavigation() {
  const { routes, isRouteActive } = useNavigation();
  const [activeTabPosition, setActiveTabPosition] = useState({ left: 0, width: 0 });
  const navRef = useRef<HTMLElement>(null);
  const activeTabRef = useRef<HTMLAnchorElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [overflowingTabs, setOverflowingTabs] = useState<typeof routes>([]);
  const [visibleTabs, setVisibleTabs] = useState<typeof routes>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const lastWidthRef = useRef<number>(0);
  const initializingRef = useRef<boolean>(true);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Filter and sort navigation items
  const navItems = routes
    .filter(route => route.showInNav)
    .sort((a, b) => a.order - b.order);

  // Update indicator when active tab changes
  const updateActiveIndicator = useCallback(() => {
    if (activeTabRef.current && navRef.current) {
      const tabRect = activeTabRef.current.getBoundingClientRect();
      const navRect = navRef.current.getBoundingClientRect();

      setActiveTabPosition({
        left: tabRect.left - navRect.left,
        width: tabRect.width
      });
    }
  }, []);

  // Check for overflowing tabs
  const checkForOverflow = useCallback(() => {
    if (!navRef.current || !tabsContainerRef.current || navItems.length === 0) return;

    const container = navRef.current;
    const containerWidth = container.clientWidth;

    // Don't process if container is too small during initial layout
    if (containerWidth < 50) return;

    // Track if we're growing or shrinking
    const isGrowing = containerWidth > lastWidthRef.current;
    lastWidthRef.current = containerWidth;

    // If growing, check if we can fit all tabs
    if (isGrowing && overflowingTabs.length > 0) {
      // Check if all tabs would fit
      const tempDiv = document.createElement('div');
      tempDiv.style.cssText = 'position:absolute;visibility:hidden;display:flex;';
      tempDiv.className = styles.tabsContainer;
      document.body.appendChild(tempDiv);

      navItems.forEach(item => {
        const tabEl = document.createElement('a');
        tabEl.className = styles.tab;
        tabEl.innerHTML = `<span class="${styles.tabText}">${item.title}</span>`;
        if (typeof item.icon !== 'undefined') { // Fixed icon check
          tabEl.innerHTML = `<span class="${styles.tabIcon}"></span>` + tabEl.innerHTML;
        }
        tempDiv.appendChild(tabEl);
      });

      const allTabsWidth = tempDiv.offsetWidth;
      document.body.removeChild(tempDiv);

      // If all tabs fit, show them all
      if (allTabsWidth <= containerWidth - 20) { // 20px buffer
        setVisibleTabs(navItems);
        setOverflowingTabs([]);
        return;
      }
    }

    // Calculate how many tabs fit with the More dropdown
    const moreButtonWidth = moreButtonRef.current ? moreButtonRef.current.offsetWidth : 80;
    const availableWidth = containerWidth - moreButtonWidth - 10; // 10px buffer

    let visibleCount = 0;
    let currentWidth = 0;

    // Get tab elements or create temp tabs for measurement
    const tabElements = Array.from(tabsContainerRef.current.querySelectorAll(`.${styles.tab}`));

    if (tabElements.length === 0 && navItems.length > 0) {
      // Create temporary elements to measure
      const tempDiv = document.createElement('div');
      tempDiv.style.cssText = 'position:absolute;visibility:hidden;';
      tempDiv.className = styles.tabsContainer;
      document.body.appendChild(tempDiv);

      const tempTabs = navItems.map(item => {
        const tabEl = document.createElement('a');
        tabEl.className = styles.tab;
        tabEl.innerHTML = `<span class="${styles.tabText}">${item.title}</span>`;
        if (typeof item.icon !== 'undefined') { // Fixed icon check
          tabEl.innerHTML = `<span class="${styles.tabIcon}"></span>` + tabEl.innerHTML;
        }
        tempDiv.appendChild(tabEl);
        return tabEl;
      });

      // Measure each tab
      for (let i = 0; i < tempTabs.length; i++) {
        const tabWidth = tempTabs[i].offsetWidth + 8; // 8px for gap
        if (currentWidth + tabWidth > availableWidth) break;
        currentWidth += tabWidth;
        visibleCount++;
      }

      document.body.removeChild(tempDiv);
    } else {
      // Use existing tabs for measurement
      for (let i = 0; i < tabElements.length && i < navItems.length; i++) {
        const tabWidth = (tabElements[i] as HTMLElement).offsetWidth + 8; // 8px for gap
        if (currentWidth + tabWidth > availableWidth) break;
        currentWidth += tabWidth;
        visibleCount++;
      }
    }

    // Ensure at least one tab is visible
    visibleCount = Math.max(1, Math.min(visibleCount, navItems.length));

    // Create new tab arrays
    const newVisibleTabs = navItems.slice(0, visibleCount);
    const newOverflowingTabs = navItems.slice(visibleCount);

    // Only update if tabs have changed
    const visiblePathsStr = JSON.stringify(visibleTabs.map(t => t.path));
    const newVisiblePathsStr = JSON.stringify(newVisibleTabs.map(t => t.path));

    if (visiblePathsStr !== newVisiblePathsStr) {
      setVisibleTabs(newVisibleTabs);
      setOverflowingTabs(newOverflowingTabs);
    }
  }, [navItems, overflowingTabs.length, visibleTabs]);

  // Initialize tabs on mount
  useEffect(() => {
    if (navItems.length > 0 && initializingRef.current) {
      setVisibleTabs(navItems);
      setOverflowingTabs([]);

      // Wait for DOM to be ready
      requestAnimationFrame(() => {
        if (navRef.current) {
          lastWidthRef.current = navRef.current.clientWidth;
          checkForOverflow();
          initializingRef.current = false;
        }
      });
    }
  }, [navItems, checkForOverflow]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownOpen &&
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node) &&
          moreButtonRef.current &&
          !moreButtonRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Set up resize observer for container
  useEffect(() => {
    if (!navRef.current) return;

    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = setTimeout(() => {
        checkForOverflow();
        updateActiveIndicator();
      }, 100);
    };

    // Set up ResizeObserver
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(navRef.current);

    // Also handle window resize and orientation change
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);

      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [checkForOverflow, updateActiveIndicator]);

  // Update indicator when tabs change or active route changes
  useEffect(() => {
    if (!initializingRef.current && activeTabRef.current) {
      requestAnimationFrame(updateActiveIndicator);
    }
  }, [visibleTabs, isRouteActive, updateActiveIndicator]);

  // No tabs to render
  if (navItems.length === 0) {
    return null;
  }

  // Check if active route is in overflow
  const isActiveInOverflow = overflowingTabs.some(route => isRouteActive(route.path));

  return (
    <nav ref={navRef} className={styles.navContainer}>
      <div ref={tabsContainerRef} className={styles.tabsContainer}>
        {/* Visible tabs */}
        {visibleTabs.map(route => (
          <Link
            key={route.path}
            href={route.path}
            ref={isRouteActive(route.path) ? activeTabRef : null}
            className={`${styles.tab} ${isRouteActive(route.path) ? styles.activeTab : ''}`}
            onClick={() => setDropdownOpen(false)}
          >
            {hasIcon(route) && (
              <span className={styles.tabIcon}>
                <route.icon />
              </span>
            )}
            <span className={styles.tabText}>{route.title}</span>

            {hasBadge(route) && (
              <span className={styles.badge}>{route.badge > 99 ? '99+' : route.badge}</span>
            )}
          </Link>
        ))}

        {/* More dropdown for overflowing tabs */}
        {overflowingTabs.length > 0 && (
          <div
            ref={dropdownRef}
            className={`${styles.moreDropdown} ${dropdownOpen ? styles.dropdownOpen : ''} ${isActiveInOverflow ? styles.activeDropdown : ''}`}
          >
            <button
              ref={moreButtonRef}
              className={styles.moreButton}
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-label="More navigation options"
              aria-expanded={dropdownOpen}
            >
              <FiMoreHorizontal className={styles.moreIcon} />
              <span className={styles.moreText}>More</span>
              <FiChevronDown className={styles.dropdownArrow} />
            </button>

            <div className={styles.dropdownMenu}>
              {overflowingTabs.map(route => (
                <Link
                  key={route.path}
                  href={route.path}
                  className={`${styles.dropdownItem} ${isRouteActive(route.path) ? styles.active : ''}`}
                  onClick={() => setDropdownOpen(false)}
                >
                  {hasIcon(route) && (
                    <span className={styles.dropdownIcon}>
                      <route.icon />
                    </span>
                  )}
                  <span>{route.title}</span>

                  {hasBadge(route) && (
                    <span className={styles.dropdownBadge}>
                      {route.badge > 99 ? '99+' : route.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Animated indicator for active visible tab */}
        {!isActiveInOverflow && activeTabPosition.width > 0 && (
          <div
            className={styles.activeIndicator}
            style={{
              transform: `translateX(${activeTabPosition.left}px)`,
              width: `${activeTabPosition.width}px`,
              opacity: 1
            }}
          />
        )}
      </div>
    </nav>
  );
}
