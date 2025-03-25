"use client";

import React, { useEffect, useRef } from 'react';
import { useNavigation } from '@/contexts/navigation/NavigationContext';
import { IconType } from 'react-icons';
import { usePathname } from 'next/navigation';
import { useEnv } from '@/hooks/useEnv';

interface PageWrapperProps {
  title: string;
  icon?: IconType;
  showInNav?: boolean;
  order?: number;
  children: React.ReactNode;
}

export function PageWrapper({
  title,
  icon,
  children,
  showInNav = true,
  order = 100
}: PageWrapperProps) {
  const { updateRouteInfo } = useNavigation();
  const pathname = usePathname() || '/';
  const appName = useEnv('APP_NAME', 'comAlt');

  // Use a ref to track first render
  const isFirstRender = useRef(true);

  // This effect should only run once per mount
  useEffect(() => {
    // Check if we're on the client side
    if (typeof window !== 'undefined' && isFirstRender.current) {
      updateRouteInfo({
        path: pathname,
        title,
        icon,
        showInNav,
        order
      });

      // Update document title, using the value from our hook
      document.title = `${title} | ${appName}`;

      isFirstRender.current = false;
    }
  }, [pathname, title, icon, showInNav, order, updateRouteInfo, appName]);

  return <>{children}</>;
}
