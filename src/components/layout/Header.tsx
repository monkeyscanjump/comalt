import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import WalletConnector from '@/components/wallet/WalletConnector';
import { useAuth } from '@/contexts/auth';
import styles from '@/app/layout.module.css';

export function Header() {
  const { isPublicMode } = useAuth();

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <Link href="/" className={styles.headerLogo}>
          <Image
            src="/logo.svg"
            alt="comAlt"
            width={180}
            height={40}
            priority
          />
        </Link>
      </div>

      <div className={styles.headerRight}>
        {/* Only show WalletConnector if not in public mode */}
        {!isPublicMode && <WalletConnector />}
      </div>
    </header>
  );
}
