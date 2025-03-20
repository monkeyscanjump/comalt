"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  const [routes, setRoutesState] = useState<RouteInfo[]>(navigationState.routes);
  const pathname = usePathname() || '/';

  /**
   * Set routes with order enforcement and update global state
   */
  const setRoutes = useCallback((newRoutes: RouteInfo[]) => {
    // Always force sort routes to maintain consistent order
    const sortedRoutes = [...newRoutes].sort((a, b) => a.order - b.order);

    // Check if anything actually changed before updating state
    const currentJSON = JSON.stringify(navigationState.routes);
    const newJSON = JSON.stringify(sortedRoutes);

    if (currentJSON === newJSON) {
      return navigationState.routes; // No change, return existing routes
    }

    // Update both component state and global state
    navigationState.routes = sortedRoutes;
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
   */
  useEffect(() => {
    const loadOrDiscoverRoutes = async () => {
      // Skip if already initialized
      if (navigationState.initialized) {
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
    };

    loadOrDiscoverRoutes();
  }, [setRoutes, updateRouteInfoInternal]);

  return (
    <NavigationContext.Provider
      value={{
        routes,
        currentPath: pathname,
        updateRouteInfo,
        isRouteActive,
      }}
    >
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
