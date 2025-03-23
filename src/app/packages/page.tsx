"use client";

import React, { useState, useEffect, useContext, useCallback } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import AuthContext from '@/contexts/auth/AuthContext';
import { LoadingState } from '@/components/LoadingState';
import { FiPackage, FiRefreshCw, FiAlertTriangle, FiSearch, FiFilter } from 'react-icons/fi';
import styles from '@/app/page.module.css';
import packageStyles from './packages.module.css';
import { Package } from '@/types/packages';
import { PackageCard } from '@/components/packages/PackageCard';
import { PackageInstallModal } from '@/components/packages/PackageInstallModal';

export default function PackagesPage() {
  const auth = useContext(AuthContext);
  const [packages, setPackages] = useState<Package[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [packageToInstall, setPackageToInstall] = useState<Package | null>(null);
  const [isInstallingId, setIsInstallingId] = useState<string | null>(null);
  const [isUninstallingId, setIsUninstallingId] = useState<string | null>(null);

  // Get token from auth context
  const token = auth?.token;

  // Fetch packages data
  const fetchPackages = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/packages', { headers });

      if (!response.ok) {
        throw new Error(`Failed to fetch packages: ${response.status}`);
      }

      const data = await response.json();
      setPackages(data);
      setFilteredPackages(data);
    } catch (err) {
      setError(`Error fetching packages: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Package fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Initial data fetch
  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  // Filter packages based on search query and category
  useEffect(() => {
    let filtered = [...packages];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(pkg =>
        pkg.name.toLowerCase().includes(query) ||
        (pkg.description?.toLowerCase().includes(query) || false) || // Add null check with optional chaining
        (pkg.tags && pkg.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(pkg => pkg.category === selectedCategory);
    }

    setFilteredPackages(filtered);
  }, [packages, searchQuery, selectedCategory]);

  // Extract unique categories from packages
  const categories = Array.from(new Set(packages.map(pkg => pkg.category)));

  // Handle search input
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  // Handle category filter
  const handleCategoryChange = (category: string | null) => {
    setSelectedCategory(category === selectedCategory ? null : category);
  };

  // Handle package installation
  const handleInstall = async (pkg: Package, installPath: string) => {
    try {
      setIsInstallingId(pkg.id);
      setPackageToInstall(null);

      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/packages/${pkg.id}/install`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ installPath })
      });

      if (!response.ok) {
        throw new Error(`Installation failed: ${response.statusText}`);
      }

      // Update UI after successful installation
      await fetchPackages();
    } catch (err) {
      setError(`Installation error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsInstallingId(null);
    }
  };

  // Handle package uninstallation
  const handleUninstall = async (pkg: Package) => {
    if (!confirm(`Are you sure you want to uninstall ${pkg.name}? This will remove all files.`)) {
      return;
    }

    try {
      setIsUninstallingId(pkg.id);

      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/packages/${pkg.id}/uninstall`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        throw new Error(`Uninstallation failed: ${response.statusText}`);
      }

      // Update UI after successful uninstallation
      await fetchPackages();
    } catch (err) {
      setError(`Uninstallation error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUninstallingId(null);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchPackages();
  };

  // Render loading state
  if (isLoading && packages.length === 0) {
    return (
      <PageWrapper title="Packages" showInNav={true} order={2}>
        <LoadingState message="Loading packages..." />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Packages" showInNav={true} order={2}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleContainer}>
            <h1 className={styles.title}>
              <FiPackage className={styles.titleIcon} />
              Packages
            </h1>
            <p className={styles.lastRefresh}>
              Install and manage software packages
            </p>
          </div>

          <div className={styles.controls}>
            <button
              onClick={handleRefresh}
              className={styles.buttonPrimary}
              disabled={isLoading}
            >
              <FiRefreshCw className={`${styles.buttonIconLeft} ${isLoading ? styles.spinning : ''}`} />
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className={styles.errorBanner}>
            <div className={styles.errorContent}>
              <FiAlertTriangle className={styles.errorIcon} />
              <div className={styles.errorMessage}>
                <p className={styles.errorText}>{error}</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              className={styles.retryButton}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Search and filter */}
        <div className={packageStyles.filtersContainer}>
          <div className={packageStyles.searchContainer}>
            <FiSearch className={packageStyles.searchIcon} />
            <input
              type="text"
              placeholder="Search packages..."
              value={searchQuery}
              onChange={handleSearchChange}
              className={packageStyles.searchInput}
            />
          </div>

          <div className={packageStyles.categoryFilters}>
            <div className={packageStyles.filterLabel}>
              <FiFilter /> Categories:
            </div>
            {categories.map(category => (
              <button
                key={category}
                className={`${packageStyles.categoryButton} ${selectedCategory === category ? packageStyles.categoryActive : ''}`}
                onClick={() => handleCategoryChange(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Package grid */}
        <div className={packageStyles.packagesGrid}>
          {filteredPackages.map(pkg => (
            <PackageCard
              key={pkg.id}
              package={pkg}
              onInstall={() => setPackageToInstall(pkg)}
              onUninstall={handleUninstall}
              isInstalling={isInstallingId === pkg.id}
              isUninstalling={isUninstallingId === pkg.id}
            />
          ))}

          {filteredPackages.length === 0 && !isLoading && (
            <div className={packageStyles.noResults}>
              <p>No packages match your search criteria.</p>
              {searchQuery || selectedCategory ? (
                <button
                  className={styles.buttonSecondary}
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory(null);
                  }}
                >
                  Clear Filters
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Install modal */}
      {packageToInstall && (
        <PackageInstallModal
          package={packageToInstall}
          onInstall={handleInstall}
          onCancel={() => setPackageToInstall(null)}
        />
      )}
    </PageWrapper>
  );
}
