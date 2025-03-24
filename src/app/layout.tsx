"use client";

import { useEffect, useState } from 'react';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { AuthProvider } from '@/contexts/auth';
import { ThemeProvider } from '@/contexts/theme/ThemeContext';
import { NavigationProvider } from '@/contexts/navigation/NavigationContext';
import ClientLayout from '@/components/layout/ClientLayout';
import { config } from '@/config';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Set initial theme class based on local storage or default to light
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('[Layout] Initializing auth state');
      // Check if auth is set up
      const hasAuthToken = localStorage.getItem(config.auth.tokenName) !== null;
      const isPublicMode = localStorage.getItem(config.auth.publicModeFlag) === 'true';

      console.log('[Layout] Auth check:', { hasAuthToken, isPublicMode });

      // If we have auth info or we're in public mode, mark auth as ready
      if (hasAuthToken || isPublicMode) {
        console.log('[Layout] Auth ready - token or public mode detected');
        setIsAuthReady(true);
      } else {
        // Increased timeout to allow auth to initialize
        const timer = setTimeout(() => {
          console.log('[Layout] Auth ready - timed initialization');
          setIsAuthReady(true);
        }, 800); // Increased from 300ms to 800ms for more reliable initialization

        return () => clearTimeout(timer);
      }
    }
  }, []);

  return (
    <html lang="en" className={!isAuthReady ? 'no-content' : ''}>
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider>
            <NavigationProvider>
              <ClientLayout>{children}</ClientLayout>
            </NavigationProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
