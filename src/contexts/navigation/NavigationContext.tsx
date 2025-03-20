"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { discoverPages } from '@/utils/pageDiscovery';
import { RouteInfo } from '@/config/routes';

// Navigation context types
interface NavigationContextType {
  routes: RouteInfo[];
  currentPath: string;
  updateRouteInfo: (routeInfo: Partial<RouteInfo> & { path: string }) => void;
  isRouteActive: (path: string) => boolean;
}

// Create context
const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

// Track routes globally to prevent state loss during re-renders
let globalRoutes: RouteInfo[] = [];

// Create provider component
export function NavigationProvider({ children }: { children: React.ReactNode }) {
  // Initialize with discovered routes or previously saved routes
  const [routes, setRoutes] = useState<RouteInfo[]>(globalRoutes.length > 0 ? globalRoutes : []);
  const pathname = usePathname() || '/';

  // Discover all pages at startup (only if we don't have routes yet)
  useEffect(() => {
    if (globalRoutes.length === 0) {
      const discoveredPages = discoverPages();
      setRoutes(discoveredPages);
      globalRoutes = discoveredPages;
    }
  }, []);

  // Check if a route is currently active
  const isRouteActive = (path: string): boolean => {
    // Exact match for home page
    if (path === '/' && pathname === '/') return true;
    // Prefix match for other pages
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  // Update route information
  const updateRouteInfo = useCallback((routeInfo: Partial<RouteInfo> & { path: string }) => {

    setRoutes(prevRoutes => {
      // Check if this route already exists
      const existingIndex = prevRoutes.findIndex(r => r.path === routeInfo.path);

      if (existingIndex >= 0) {
        // Skip update if nothing changed to prevent infinite loops
        const existingRoute = prevRoutes[existingIndex];
        const hasChanges =
          (routeInfo.title !== undefined && routeInfo.title !== existingRoute.title) ||
          (routeInfo.icon !== undefined && routeInfo.icon !== existingRoute.icon) ||
          (routeInfo.order !== undefined && routeInfo.order !== existingRoute.order) ||
          (routeInfo.showInNav !== undefined && routeInfo.showInNav !== existingRoute.showInNav);

        if (!hasChanges) {
          return prevRoutes; // Return previous state to avoid re-render
        }

        // Update existing route
        const newRoutes = [...prevRoutes];
        newRoutes[existingIndex] = {
          ...newRoutes[existingIndex],
          ...routeInfo
        };
        return newRoutes;
      }

      // For a new route, we need to ensure all required fields are present
      const completeRouteInfo: RouteInfo = {
        path: routeInfo.path,
        title: routeInfo.title || routeInfo.path.split('/').pop() || 'Page',
        icon: routeInfo.icon || null as any, // Use appropriate default for your app
        order: routeInfo.order || 100,
        showInNav: routeInfo.showInNav ?? true
      };

      // Add new route
      return [...prevRoutes, completeRouteInfo].sort((a, b) => a.order - b.order);
    });
  }, []);

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

// Custom hook to use navigation
export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
