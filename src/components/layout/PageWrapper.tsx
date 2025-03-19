"use client";

import React, { useEffect } from 'react';
import { useNavigation } from '@/contexts/navigation/NavigationContext';
import { IconType } from 'react-icons';
import { usePathname } from 'next/navigation';

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

  // PageWrapper now enhances prediscovered routes with additional metadata
  useEffect(() => {
    updateRouteInfo({
      path: pathname,
      title,
      icon,
      showInNav,
      order
    });

    console.log(`Page metadata enhanced: ${title} at path: ${pathname}`);
  }, [title, icon, pathname, showInNav, order, updateRouteInfo]);

  return <>{children}</>;
}
