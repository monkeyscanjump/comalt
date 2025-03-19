"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/auth';
import { LoadingState } from './LoadingState';
import { ConnectWallet } from './ConnectWallet';
import { AccessDenied } from './AccessDenied';
import { SignatureRequest } from './SignatureRequest';
import { hasWhitelistedAddresses } from '@/config/whitelist';
import { usePathname } from 'next/navigation';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const {
    isAuthenticated,
    isLoading,
    isAllowed,
    isWalletConnected,
    walletAddress,
    wasSignatureRejected
  } = useAuth();
  const pathname = usePathname();

  // Check if whitelist is empty - if so, public mode is active
  const isPublicMode = !hasWhitelistedAddresses();

  // Debug auth state for troubleshooting
  useEffect(() => {
    console.log(`Auth state (${pathname}): authenticated=${isAuthenticated}, allowed=${isAllowed}, public=${isPublicMode}`);
  }, [isAuthenticated, isAllowed, isPublicMode, pathname]);

  // Regular authentication flow
  if (isLoading) {
    return <LoadingState />;
  }

  if (!isWalletConnected) {
    return <ConnectWallet showTitle={true} />;
  }

  if (isWalletConnected && !isAllowed) {
    return <AccessDenied walletAddress={walletAddress} />;
  }

  if (isWalletConnected && isAllowed && !isAuthenticated) {
    return <SignatureRequest wasRejected={wasSignatureRejected} />;
  }

  if (isPublicMode || (isAuthenticated && isAllowed)) {
    return <>{children}</>;
  }

  // Fallback
  return <ConnectWallet showTitle={false} />;
}
