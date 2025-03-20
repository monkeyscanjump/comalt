"use client";

import React, { useEffect, useRef } from 'react';
import { useNavigation } from '@/contexts/navigation/NavigationContext';
import { IconType } from 'react-icons';
import { usePathname } from 'next/navigation';
import { getPublicEnv } from '@/utils/env';

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

  // Use a ref to track first render
  const isFirstRender = useRef(true);

  // This effect should only run once per mount
  useEffect(() => {
    // Only update route info on first render
    if (isFirstRender.current) {
      updateRouteInfo({
        path: pathname,
        title,
        icon,
        showInNav,
        order
      });

      // Update document title
      const appName = getPublicEnv('APP_NAME', 'comalt');
      document.title = `${title} | ${appName}`;

      isFirstRender.current = false;
    }
  }, [pathname, title, icon, showInNav, order, updateRouteInfo]);

  return <>{children}</>;
}
