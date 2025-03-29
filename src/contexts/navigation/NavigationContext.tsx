"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { discoverPages } from '@/utils/pageDiscovery';
import { RouteInfo } from '@/config/routes';

/**
 * Navigation context structure defining the interface for navigation data and functions
 */
interface NavigationContextType {
  routes: RouteInfo[];
  currentPath: string;
  updateRouteInfo: (routeInfo: Partial<RouteInfo> & { path: string }) => void;
  isRouteActive: (path: string) => boolean;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

/**
 * Global storage that persists between renders
 */
const navigationState = {
  routes: [] as RouteInfo[],
  initialized: false,
  pendingUpdates: [] as Array<Partial<RouteInfo> & { path: string }>,
  discoveryTimestamp: 0
};

/**
 * Provider component that manages application navigation state and discovery
 */
export function NavigationProvider({ children }: { children: React.ReactNode }) {
  // Use a ref to track render causes
  const debugRef = React.useRef({ renders: 0, lastPathname: '' });

  const [routes, setRoutesState] = useState<RouteInfo[]>(() => navigationState.routes);
  const pathname = usePathname() || '/';

  // Debug render causes
  if (process.env.NODE_ENV === 'development') {
    debugRef.current.renders++;
    if (debugRef.current.lastPathname !== pathname) {
      console.log(`[NavigationProvider] Pathname changed: ${debugRef.current.lastPathname} -> ${pathname}`);
      debugRef.current.lastPathname = pathname;
    }
  }

  /**
   * Set routes with order enforcement and update global state
   */
  const setRoutes = useCallback((newRoutes: RouteInfo[]) => {
    // Always force sort routes to maintain consistent order
    const sortedRoutes = [...newRoutes].sort((a, b) => a.order - b.order);

    // Check if anything actually changed before updating state
    // Use a deep comparison by serializing to JSON
    const currentJSON = JSON.stringify(navigationState.routes);
    const newJSON = JSON.stringify(sortedRoutes);

    if (currentJSON === newJSON) {
      return navigationState.routes; // No change, return existing routes
    }

    // Update both component state and global state
    navigationState.routes = sortedRoutes;

    // Use functional state update to ensure we're working with the latest state
    setRoutesState(sortedRoutes);

    // Store sorted routes in session storage for stability on refresh
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('nav-routes', JSON.stringify(
          sortedRoutes.map(r => ({ path: r.path, order: r.order }))
        ));
      }
    } catch (e) {
      // Ignore storage errors
    }

    return sortedRoutes;
  }, []);

  /**
   * Determines if a given route path is currently active
   * This is memoized based on the current pathname to prevent unnecessary recalculations
   */
  const isRouteActive = useCallback((path: string): boolean => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  }, [pathname]);

  /**
   * Internal implementation to update route information
   */
  const updateRouteInfoInternal = useCallback((routeInfo: Partial<RouteInfo> & { path: string }) => {
    const currentRoutes = [...navigationState.routes];
    const existingIndex = currentRoutes.findIndex(r => r.path === routeInfo.path);

    let updatedRoutes: RouteInfo[] = [];

    if (existingIndex >= 0) {
      const existingRoute = currentRoutes[existingIndex];
      const hasChanges =
        (routeInfo.title !== undefined && routeInfo.title !== existingRoute.title) ||
        (routeInfo.icon !== undefined && routeInfo.icon !== existingRoute.icon) ||
        (routeInfo.order !== undefined && routeInfo.order !== existingRoute.order) ||
        (routeInfo.showInNav !== undefined && routeInfo.showInNav !== existingRoute.showInNav);

      // Skip update if nothing changed
      if (!hasChanges) {
        return;
      }

      updatedRoutes = [...currentRoutes];
      updatedRoutes[existingIndex] = {
        ...updatedRoutes[existingIndex],
        ...routeInfo
      };
    } else {
      const completeRouteInfo: RouteInfo = {
        path: routeInfo.path,
        title: routeInfo.title || routeInfo.path.split('/').pop() || 'Page',
        icon: routeInfo.icon || null as any,
        order: routeInfo.order || 100,
        showInNav: routeInfo.showInNav ?? true
      };

      updatedRoutes = [...currentRoutes, completeRouteInfo];
    }

    setRoutes(updatedRoutes);
  }, [setRoutes]);

  /**
   * Public method for components to update route information
   */
  const updateRouteInfo = useCallback((routeInfo: Partial<RouteInfo> & { path: string }) => {
    if (!navigationState.initialized) {
      navigationState.pendingUpdates.push(routeInfo);
      return;
    }

    updateRouteInfoInternal(routeInfo);
  }, [updateRouteInfoInternal]);

  /**
   * Initialize navigation with discovered routes
   * This effect should only run once at mount
   */
  useEffect(() => {
    // Flag to prevent double initialization
    let isActive = true;

    const loadOrDiscoverRoutes = async () => {
      // Skip if already initialized or if component unmounted
      if (navigationState.initialized || !isActive) {
        return;
      }

      // Attempt to restore from session storage for consistent order
      const storedOrderMap: Record<string, number> = {};
      try {
        if (typeof window !== 'undefined') {
          const storedRoutes = window.sessionStorage.getItem('nav-routes');
          if (storedRoutes) {
            const parsedRoutes = JSON.parse(storedRoutes);
            parsedRoutes.forEach((r: { path: string, order: number }) => {
              storedOrderMap[r.path] = r.order;
            });
          }
        }
      } catch (e) {
        // Ignore storage errors
      }

      // Discover pages
      const discoveredPages = discoverPages();

      // Apply stored orders if available
      const pagesWithOrders = discoveredPages.map(page => {
        if (storedOrderMap[page.path] !== undefined) {
          return { ...page, order: storedOrderMap[page.path] };
        }
        return page;
      });

      // Only update if component is still mounted
      if (isActive) {
        // Update state with sorted pages
        setRoutes(pagesWithOrders);

        // Mark as initialized
        navigationState.initialized = true;

        // Process any pending updates
        if (navigationState.pendingUpdates.length > 0) {
          const updates = [...navigationState.pendingUpdates];
          navigationState.pendingUpdates = [];

          updates.forEach(update => {
            updateRouteInfoInternal(update);
          });
        }
      }
    };

    loadOrDiscoverRoutes();

    // Cleanup
    return () => {
      isActive = false;
    };
  }, []); // Empty dependency array - should only run once

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    routes,
    currentPath: pathname,
    updateRouteInfo,
    isRouteActive,
  }), [routes, pathname, updateRouteInfo, isRouteActive]);

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  );
}

/**
 * Custom hook to access navigation context from components
 */
export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
