"use client";

import React, { useEffect } from 'react';
import { DynamicHeader } from '@/components/layout/DynamicHeader';
import { Footer } from '@/components/layout/Footer';
import { AuthGuard } from '@/components/auth/AuthGuard';
import DebugAuth from '@/components/DebugAuth';
import styles from '@/app/layout.module.css';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const isDev = process.env.NODE_ENV !== 'production';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Use require instead of import to avoid TypeScript errors
      try {
        require('focus-visible');
      } catch (err) {
        console.error('Error loading focus-visible polyfill:', err);
      }
    }
  }, []);

  return (
    <div className={styles.layoutContainer}>
      <DynamicHeader />

      <main className={styles.main}>
        <AuthGuard>{children}</AuthGuard>
      </main>

      <Footer />

      {isDev && <DebugAuth />}
    </div>
  );
}
