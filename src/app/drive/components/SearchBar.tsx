import React from 'react';
import { FiSearch } from 'react-icons/fi';
import styles from '../drive.module.css';

interface SearchBarProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => {
  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchInputWrapper}>
        <FiSearch className={styles.searchIcon} />
        <input
          type="text"
          placeholder="Search files..."
          value={value}
          onChange={onChange}
          className={styles.searchInput}
        />
      </div>
    </div>
  );
};
