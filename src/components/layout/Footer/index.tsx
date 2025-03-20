import React from 'react';
// import Link from 'next/link';
import { getPublicEnv } from '@/utils/env';
import styles from '@/app/layout.module.css';

export function Footer() {
  const appName = getPublicEnv('APP_NAME', 'comAlt');
  const appVersion = getPublicEnv('APP_VERSION', '1.0.0');

  return (
    <footer className={styles.footer}>
      {/* <div className={styles.footerContainer}>
        <div className={styles.footerSection}>
          <h4 className={styles.footerHeading}>comAlt Download Manager</h4>
          <p className={styles.footerText}>
            A secure and efficient solution for managing downloads on the Polkadot ecosystem.
          </p>
          <p className={styles.footerVersion}>Version {appVersion}</p>
        </div>

        <div className={styles.footerSection}>
          <h4 className={styles.footerHeading}>Links</h4>
          <nav className={styles.footerNav}>
            <Link href="/about" className={styles.footerLink}>About</Link>
            <Link href="/docs" className={styles.footerLink}>Documentation</Link>
            <Link href="/privacy" className={styles.footerLink}>Privacy Policy</Link>
            <Link href="/terms" className={styles.footerLink}>Terms of Service</Link>
          </nav>
        </div>

        <div className={styles.footerSection}>
          <h4 className={styles.footerHeading}>Contact</h4>
          <p className={styles.footerText}>
            For support inquiries: <a href="mailto:support@comalt.io" className={styles.footerLink}>support@comAlt.io</a>
          </p>
        </div>
      </div> */}

      <div className={styles.footerBottom}>
        <p className={styles.copyright}>
        {appName} v {appVersion}
        </p>
      </div>
    </footer>
  );
}
