"use client";

import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import Link from 'next/link';
import { useNavigation } from '@/contexts/navigation/NavigationContext';
import { FiMoreHorizontal, FiChevronDown } from 'react-icons/fi';
import styles from './MainNavigation.module.css';

/**
 * Type guard to check if a route has a badge property
 */
function hasBadge(route: any): route is { badge: number } {
  return route && typeof route.badge === 'number' && route.badge > 0;
}

/**
 * Helper function to check if a route has an icon component
 */
function hasIcon(route: any): boolean {
  return route && typeof route.icon !== 'undefined';
}

/**
 * Main Navigation component that handles responsive tab display with overflow menu
 * Automatically adjusts visible tabs based on available space
 */
function MainNavigationComponent() {
  const { routes, isRouteActive } = useNavigation();
  const [activeTabPosition, setActiveTabPosition] = useState({ left: 0, width: 0 });
  const [overflowingTabs, setOverflowingTabs] = useState<typeof routes>([]);
  const [visibleTabs, setVisibleTabs] = useState<typeof routes>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // DOM refs
  const navRef = useRef<HTMLElement>(null);
  const activeTabRef = useRef<HTMLAnchorElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  // State tracking refs
  const lastWidthRef = useRef<number>(0);
  const initializingRef = useRef<boolean>(true);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasSetTabsRef = useRef(false);
  const prevVisibleTabsRef = useRef<string>('');

  /**
   * Filter and sort navigation items
   */
  const navItems = React.useMemo(() => {
    return routes
      .filter(route => route.showInNav)
      .sort((a, b) => a.order - b.order);
  }, [routes]);

  /**
   * Updates the active tab indicator position
   */
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

  /**
   * Calculates which tabs should be visible and which should be in the overflow menu
   * Uses DOM measurement to determine how many tabs fit in the available space
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkForOverflow = useCallback(() => {
    if (!navRef.current || !tabsContainerRef.current || navItems.length === 0) return;

    const container = navRef.current;
    const containerWidth = container.clientWidth;

    if (containerWidth < 50) return;

    lastWidthRef.current = containerWidth;

    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position:absolute;visibility:hidden;display:flex;';
    tempDiv.className = styles.tabsContainer;
    document.body.appendChild(tempDiv);

    navItems.forEach(item => {
      const tabEl = document.createElement('a');
      tabEl.className = styles.tab;
      tabEl.innerHTML = `<span class="${styles.tabText}">${item.title}</span>`;
      if (typeof item.icon !== 'undefined') {
        tabEl.innerHTML = `<span class="${styles.tabIcon}"></span>` + tabEl.innerHTML;
      }
      tempDiv.appendChild(tabEl);
    });

    const allTabsWidth = tempDiv.offsetWidth;
    document.body.removeChild(tempDiv);

    let newVisibleTabs: typeof routes;
    let newOverflowingTabs: typeof routes;

    if (allTabsWidth <= containerWidth - 20) {
      newVisibleTabs = navItems;
      newOverflowingTabs = [];
    } else {
      const moreButtonWidth = moreButtonRef.current ? moreButtonRef.current.offsetWidth : 80;
      const availableWidth = containerWidth - moreButtonWidth - 10;

      let visibleCount = 0;
      let currentWidth = 0;

      const tempDiv2 = document.createElement('div');
      tempDiv2.style.cssText = 'position:absolute;visibility:hidden;';
      tempDiv2.className = styles.tabsContainer;
      document.body.appendChild(tempDiv2);

      const tempTabs = navItems.map(item => {
        const tabEl = document.createElement('a');
        tabEl.className = styles.tab;
        tabEl.innerHTML = `<span class="${styles.tabText}">${item.title}</span>`;
        if (typeof item.icon !== 'undefined') {
          tabEl.innerHTML = `<span class="${styles.tabIcon}"></span>` + tabEl.innerHTML;
        }
        tempDiv2.appendChild(tabEl);
        return tabEl;
      });

      for (let i = 0; i < tempTabs.length; i++) {
        const tabWidth = tempTabs[i].offsetWidth + 8;

        if (currentWidth + tabWidth > availableWidth) {
          break;
        }

        currentWidth += tabWidth;
        visibleCount++;
      }

      document.body.removeChild(tempDiv2);

      visibleCount = Math.max(1, Math.min(visibleCount, navItems.length));

      const MIN_ITEMS_IN_DROPDOWN = 2;
      if (visibleCount >= 1 &&
          navItems.length - visibleCount > 0 &&
          navItems.length - visibleCount < MIN_ITEMS_IN_DROPDOWN) {
        visibleCount = Math.max(1, navItems.length - MIN_ITEMS_IN_DROPDOWN);
      }

      newVisibleTabs = navItems.slice(0, visibleCount);
      newOverflowingTabs = navItems.slice(visibleCount);
    }

    const newVisiblePathsStr = JSON.stringify(newVisibleTabs.map(t => t.path));
    const currentVisiblePathsStr = JSON.stringify(visibleTabs.map(t => t.path));
    const currentOverflowPathsStr = JSON.stringify(overflowingTabs.map(t => t.path));
    const newOverflowPathsStr = JSON.stringify(newOverflowingTabs.map(t => t.path));

    if (currentVisiblePathsStr !== newVisiblePathsStr ||
        currentOverflowPathsStr !== newOverflowPathsStr) {

      prevVisibleTabsRef.current = newVisiblePathsStr;

      if (currentVisiblePathsStr !== newVisiblePathsStr) {
        setVisibleTabs(newVisibleTabs);
      }

      if (currentOverflowPathsStr !== newOverflowPathsStr) {
        setOverflowingTabs(newOverflowingTabs);
      }
    }
    // eslint-disable-next-line
  }, [navItems]);

  /**
   * Initialize tabs on mount
   */
  useEffect(() => {
    if (navItems.length > 0 && !hasSetTabsRef.current) {
      hasSetTabsRef.current = true;
      setVisibleTabs(navItems);
      setOverflowingTabs([]);
      prevVisibleTabsRef.current = JSON.stringify(navItems.map(t => t.path));

      requestAnimationFrame(() => {
        if (navRef.current) {
          lastWidthRef.current = navRef.current.clientWidth;
          checkForOverflow();
          initializingRef.current = false;
        }
      });
    }
  }, [navItems, checkForOverflow]);

  /**
   * Handle clicks outside the dropdown to close it
   */
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

  /**
   * Set up resize handling to recheck tab overflow
   */
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

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(navRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [checkForOverflow, updateActiveIndicator]);

  /**
   * Update the active indicator when tabs or active route changes
   */
  useEffect(() => {
    if (initializingRef.current) return;

    const animationId = requestAnimationFrame(updateActiveIndicator);
    return () => cancelAnimationFrame(animationId);
  }, [visibleTabs, isRouteActive, updateActiveIndicator]);

  if (navItems.length === 0) {
    return null;
  }

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

// Memoize the component to prevent unnecessary re-renders
export const MainNavigation = memo(MainNavigationComponent);
