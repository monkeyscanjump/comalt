"use client";

import React from 'react';
import { useTheme } from '@/contexts/theme/ThemeContext';
import { FaSun, FaMoon } from 'react-icons/fa';
import styles from './ThemeToggle.module.css';

interface ThemeToggleProps {
  className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className={`${styles.themeToggle} ${className || ''}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      type="button"
    >
      <div className={styles.toggleTrack}>
        <div className={`${styles.toggleThumb} ${theme === 'light' ? styles.toggleThumbLight : ''}`}>
          <span className={styles.toggleIcon}>
            {theme === 'dark' ? <FaMoon /> : <FaSun />}
          </span>
        </div>
      </div>
      <span className={styles.srOnly}>
        {theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      </span>
    </button>
  );
};

export default ThemeToggle;
