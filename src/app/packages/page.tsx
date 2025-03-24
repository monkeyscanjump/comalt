"use client";

import React, { useState, useEffect, useContext, useCallback } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import AuthContext from '@/contexts/auth/AuthContext';
import { LoadingState } from '@/components/LoadingState';
import { FiPackage, FiRefreshCw, FiAlertTriangle, FiSearch, FiFilter, FiTool } from 'react-icons/fi';
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
  const [packageToUninstall, setPackageToUninstall] = useState<Package | null>(null); // New state for uninstall modal
  const [isInstallingId, setIsInstallingId] = useState<string | null>(null);
  const [isUninstallingId, setIsUninstallingId] = useState<string | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);

  // Get token from auth context
  const token = auth?.token;

  // Detect database inconsistencies
  const hasInconsistencies = packages.some(pkg =>
    (pkg.isInstalled && pkg.lastError) ||
    (pkg.isInstalled && (!pkg.installPath || pkg.installPath.trim() === ''))
  );

  // Fetch packages data with cache prevention
  const fetchPackages = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const headers: HeadersInit = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log("Fetching packages...");
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/packages?t=${timestamp}`, {
        headers,
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch packages: ${response.status}`);
      }

      const data = await response.json();
      console.log("Packages fetched:", data.length);

      setPackages(data);

      // Apply current filters to new data
      let filtered = [...data];
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(pkg =>
          pkg.name.toLowerCase().includes(query) ||
          (pkg.description?.toLowerCase().includes(query) || false) ||
          (pkg.tags && pkg.tags.some((tag: string) => tag.toLowerCase().includes(query))) // Fixed type error here
        );
      }
      if (selectedCategory) {
        filtered = filtered.filter(pkg => pkg.category === selectedCategory);
      }

      setFilteredPackages(filtered);
    } catch (err) {
      setError(`Error fetching packages: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Package fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token, searchQuery, selectedCategory]);

  // Initial data fetch
  useEffect(() => {
    fetchPackages();
    // Don't include searchQuery and selectedCategory in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Filter packages based on search query and category
  useEffect(() => {
    let filtered = [...packages];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(pkg =>
        pkg.name.toLowerCase().includes(query) ||
        (pkg.description?.toLowerCase().includes(query) || false) ||
        (pkg.tags && pkg.tags.some((tag: string) => tag.toLowerCase().includes(query))) // Fixed type error here
      );
    }

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(pkg => pkg.category === selectedCategory);
    }

    setFilteredPackages(filtered);
  }, [packages, searchQuery, selectedCategory]);

  // Extract unique categories from packages
  const categories = Array.from(new Set(packages.map(pkg => pkg.category).filter(Boolean)));

  // Handle search input
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  // Handle category filter
  const handleCategoryChange = (category: string | null) => {
    setSelectedCategory(category === selectedCategory ? null : category);
  };

  // Handle opening install modal
  const handleInstallRequest = (pkg: Package) => {
    setPackageToInstall(pkg);
  };

  // Handle opening uninstall modal
  const handleUninstallRequest = (pkg: Package) => {
    setPackageToUninstall(pkg);
  };

  // Handle package installation
  const handleInstall = async (pkg: Package, installPath: string) => {
    if (!installPath || installPath.trim() === '') {
      setError('Please provide a valid installation path');
      return;
    }

    try {
      setIsInstallingId(pkg.id);
      setPackageToInstall(null);
      setError(null);

      console.log(`Installing package ${pkg.id} at ${installPath}`);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Immediately update UI state to show as installing
      setPackages(prevPackages =>
        prevPackages.map(p =>
          p.id === pkg.id ? { ...p, isInstalling: true } : p
        )
      );

      const response = await fetch(`/api/packages/${pkg.id}/install`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ installPath })
      });

      const data = await response.json();
      console.log('Install response:', data);

      if (!response.ok) {
        throw new Error(data.error || data.details || `Installation failed: ${response.statusText}`);
      }

      // Update the specific package in state
      setPackages(prevPackages =>
        prevPackages.map(p =>
          p.id === pkg.id
            ? {
                ...p,
                isInstalled: true,
                installPath,
                installedVersion: data.installedVersion,
                installedAt: new Date().toISOString()
              }
            : p
        )
      );

      // Full refresh to get all updated data
      await fetchPackages();
    } catch (err) {
      console.error('Installation error:', err);
      setError(`Installation error: ${err instanceof Error ? err.message : String(err)}`);

      // Refresh to get the correct state even after error
      await fetchPackages();
    } finally {
      setIsInstallingId(null);
    }
  };

  // Handle package uninstallation
  const handleUninstall = async (pkg: Package) => {
    try {
      setIsUninstallingId(pkg.id);
      setPackageToUninstall(null); // Close the modal
      setError(null);

      console.log(`Uninstalling package ${pkg.id}`);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Immediately update UI state to avoid stale data
      setPackages(prevPackages =>
        prevPackages.map(p =>
          p.id === pkg.id
            ? { ...p, isInstalled: false, installedVersion: null, installedAt: null }
            : p
        )
      );

      setFilteredPackages(prevFiltered =>
        prevFiltered.map(p =>
          p.id === pkg.id
            ? { ...p, isInstalled: false, installedVersion: null, installedAt: null }
            : p
        )
      );

      // Send uninstall request
      const response = await fetch(`/api/packages/${pkg.id}/uninstall`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ forceCleanup: true })
      });

      const data = await response.json();
      console.log('Uninstall response:', data);

      if (!response.ok && !data.success) {
        throw new Error(data.error || data.details || `Uninstallation failed: ${response.statusText}`);
      }

      // Ensure we have the latest data
      await fetchPackages();
    } catch (err) {
      console.error('Uninstall error:', err);
      setError(`Uninstallation error: ${err instanceof Error ? err.message : String(err)}`);

      // Still refresh packages to show current state
      await fetchPackages();
    } finally {
      setIsUninstallingId(null);
    }
  };

  // Handle database repair
  const handleRepairDatabase = async () => {
    if (!confirm('Are you sure you want to repair the package database? This will fix inconsistencies between installed packages and the database.')) {
      return;
    }

    try {
      setIsRepairing(true);
      setError(null);

      console.log('Repairing package database');

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/packages', {
        method: 'POST',
        headers
      });

      const data = await response.json();
      console.log('Repair response:', data);

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Database repair failed');
      }

      setError(`Database repair completed: ${data.repaired.length} packages fixed`);

      // Refresh packages list
      await fetchPackages();
    } catch (err) {
      console.error('Database repair error:', err);
      setError(`Database repair failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRepairing(false);
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
            <span className={styles.lastRefresh}>
              Install and manage software packages
            </span>
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

            {/* Repair database button */}
            {hasInconsistencies && (
              <button
                onClick={handleRepairDatabase}
                className={styles.buttonWarning || styles.buttonSecondary}
                disabled={isRepairing}
              >
                <FiTool className={styles.buttonIconLeft} />
                {isRepairing ? 'Repairing...' : 'Repair Database'}
              </button>
            )}
          </div>
        </div>

        {/* Database inconsistency warning */}
        {hasInconsistencies && (
          <div className={styles.warningBanner || styles.errorBanner}>
            <div className={styles.errorContent}>
              <FiAlertTriangle className={styles.errorIcon} />
              <div className={styles.errorMessage}>
                <p className={styles.errorText}>
                  Some packages have installation issues but are still marked as installed.
                  Use the "Repair Database" button to fix these inconsistencies.
                </p>
              </div>
            </div>
          </div>
        )}

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
              onClick={() => setError(null)}
              className={styles.retryButton || styles.closeButton}
            >
              Dismiss
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

          {categories.length > 0 && (
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
          )}
        </div>

        {/* Package grid */}
        <div className={packageStyles.packagesGrid}>
          {filteredPackages.map(pkg => (
            <PackageCard
              key={pkg.id}
              package={pkg}
              onInstall={() => handleInstallRequest(pkg)}
              onUninstall={() => handleUninstallRequest(pkg)}
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
          mode="install"
          onInstall={handleInstall}
          onCancel={() => setPackageToInstall(null)}
        />
      )}

      {/* Uninstall modal */}
      {packageToUninstall && (
        <PackageInstallModal
          package={packageToUninstall}
          mode="uninstall"
          onUninstall={handleUninstall}
          onCancel={() => setPackageToUninstall(null)}
        />
      )}
    </PageWrapper>
  );
}
