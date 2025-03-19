"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { IconType } from 'react-icons';
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
      console.log('Discovering pages...');
      const discoveredPages = discoverPages();
      setRoutes(discoveredPages);
      globalRoutes = discoveredPages;
      console.log('Discovered pages:', discoveredPages);
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
  const updateRouteInfo = (routeInfo: Partial<RouteInfo> & { path: string }): void => {
    console.log(`Route updated: ${routeInfo.path} - ${routeInfo.title}`);

    setRoutes(prevRoutes => {
      // Find existing route or use new one
      const existingRouteIndex = prevRoutes.findIndex(r => r.path === routeInfo.path);

      let newRoutes;
      if (existingRouteIndex >= 0) {
        // Update existing route
        newRoutes = [...prevRoutes];
        newRoutes[existingRouteIndex] = {
          ...newRoutes[existingRouteIndex],
          ...routeInfo
        };
      } else {
        // Add new route with defaults
        const newRoute: RouteInfo = {
          path: routeInfo.path,
          title: routeInfo.title || routeInfo.path.split('/').pop() || 'Page',
          icon: routeInfo.icon || null as unknown as IconType,
          order: routeInfo.order || 100,
          showInNav: routeInfo.showInNav !== undefined ? routeInfo.showInNav : true,
        };
        newRoutes = [...prevRoutes, newRoute].sort((a, b) => a.order - b.order);
      }

      // Update global routes
      globalRoutes = newRoutes;
      return newRoutes;
    });
  };

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
