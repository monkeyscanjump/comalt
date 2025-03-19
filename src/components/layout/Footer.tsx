import React from 'react';
import styles from '@/app/layout.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <p>&copy; {new Date().getFullYear()} comAlt</p>
    </footer>
  );
}
