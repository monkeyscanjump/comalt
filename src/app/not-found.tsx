"use client";

import React from 'react';
import Link from 'next/link';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { FaExclamationTriangle } from 'react-icons/fa';
import styles from '@/app/layout.module.css';

export default function Custom404() {
  return (
    <PageWrapper
      title="Page Not Found"
      icon={FaExclamationTriangle}
      order={999}
      showInNav={false}
    >
      <div className={styles.notFoundContainer}>
        <h1 className={styles.notFoundTitle}>404 - Page Not Found</h1>
        <p className={styles.notFoundText}>
          Sorry, the page you are looking for does not exist.
        </p>
        <Link href="/" className={styles.notFoundLink}>
          Go back to the homepage
        </Link>
      </div>
    </PageWrapper>
  );
}
