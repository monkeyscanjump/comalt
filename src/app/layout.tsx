import React from 'react';
import { AuthProvider } from '@/contexts/auth';
import { NavigationProvider } from '@/contexts/navigation/NavigationContext';
import '@/styles/globals.css';

// Client Component for content
import ClientLayout from '@/components/layout/ClientLayout';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="js-focus-visible">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{process.env.NEXT_PUBLIC_APP_NAME || 'comalt'}</title>
      </head>
      <body>
        <AuthProvider>
          <NavigationProvider>
            <ClientLayout>{children}</ClientLayout>
          </NavigationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
