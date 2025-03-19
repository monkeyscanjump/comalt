"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth';
import { isAddressAllowed, isAddressAllowedAsync } from '@/config/whitelist';
import { useDraggable } from '@/utils/draggable';
import styles from './DebugAuth.module.css';

const DebugAuth = () => {
  // Check if we should render at all - environment check
  const shouldRender = typeof window !== 'undefined' && process.env.NODE_ENV !== 'production';

  // Basic state management
  const [isCollapsed, setIsCollapsed] = useState(false);
  const debugRef = useRef<HTMLDivElement>(null);

  // Use state for values that change and cause hydration errors
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  // State for async whitelist check
  const [addressAllowed, setAddressAllowed] = useState<boolean | null>(null);

  // Calculate initial position - place at bottom right by default
  const defaultX = typeof window !== 'undefined' ? Math.max(0, window.innerWidth - 350) : 0;
  const defaultY = typeof window !== 'undefined' ? Math.max(0, window.innerHeight - 350) : 0;

  // Use the draggable hook
  const {
    position,
    isDragging,
    snappedEdge,
    startDrag
  } = useDraggable(debugRef, {
    initialPosition: { x: defaultX, y: defaultY },
    persistPosition: true,
    storageKey: 'debugAuth',
    detectEdges: true,
    ignoreDragSelectors: [`.${styles.collapseButton}`, `.${styles.collapsedIndicator}`],
    targetFps: 30,
    safetyMargin: 20 // Use the new safety margin option
  });

  const {
    isAuthenticated,
    isAllowed,
    isWalletConnected,
    walletAddress,
    error,
    token,
    user,
    isLoading,
    refreshAuthToken
  } = useAuth();

  // Check if address is allowed using async API
  useEffect(() => {
    if (!walletAddress) {
      setAddressAllowed(null);
      return;
    }

    let mounted = true;

    const checkAddress = async () => {
      try {
        const isAllowed = await isAddressAllowedAsync(walletAddress);
        if (mounted) {
          setAddressAllowed(isAllowed);
        }
      } catch (error) {
        console.error('Error checking address:', error);
        if (mounted) {
          setAddressAllowed(false);
        }
      }
    };

    checkAddress();

    return () => {
      mounted = false;
    };
  }, [walletAddress]);

  // Set isClient after component mounts (client-side only)
  useEffect(() => {
    setIsClient(true);
    setCurrentTime(new Date().toLocaleTimeString());

    // Update time every 5 seconds
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 5000);

    // Try to restore collapsed state
    try {
      const savedCollapsed = localStorage.getItem('debugAuthCollapsed');
      if (savedCollapsed) {
        setIsCollapsed(JSON.parse(savedCollapsed));
      }
    } catch (e) {
      console.error('Failed to load debug panel state:', e);
    }

    return () => clearInterval(timer);
  }, []);

  // Save collapsed state to localStorage
  useEffect(() => {
    if (isClient) {
      localStorage.setItem('debugAuthCollapsed', JSON.stringify(isCollapsed));
    }
  }, [isCollapsed, isClient]);

  // Don't render anything in production or during server rendering
  if (!shouldRender || !isClient) {
    return null;
  }

  // Handle refresh token action
  const handleRefreshToken = async () => {
    if (!token) return;

    try {
      const success = await refreshAuthToken();
      if (success) {
        alert('Token refreshed successfully!');
      } else {
        alert('Failed to refresh token');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      alert('Error refreshing token');
    }
  };

  // Toggle collapse state
  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering drag when clicking the toggle button
    setIsCollapsed(!isCollapsed);
  };

  // Get container class names based on state
  const getContainerClassNames = () => {
    const classNames = [styles.debugContainer];

    // Add dragging state
    classNames.push(isDragging ? styles.debugDragging : styles.debugNormal);

    // Add content class if expanded
    if (!isCollapsed) {
      classNames.push(styles.debugExpandedContent);
    }
    // Add edge-specific and collapsed-size classes
    else {
      // Add edge-specific class first
      switch (snappedEdge) {
        case 'left': classNames.push(styles.leftEdge); break;
        case 'right': classNames.push(styles.rightEdge); break;
        case 'top': classNames.push(styles.topEdge); break;
        case 'bottom': classNames.push(styles.bottomEdge); break;
      }

      // Then add size class based on vertical/horizontal orientation
      if (snappedEdge === 'left' || snappedEdge === 'right') {
        classNames.push(styles.horizontalCollapsed);
      } else {
        classNames.push(styles.verticalCollapsed);
      }
    }

    return classNames.join(' ');
  };

  // Get inline styles for positioning
  const getPositionStyle = (): React.CSSProperties => {
    // Start with base styles
    const style: React.CSSProperties = {};

    // For collapsed state along edges
    if (isCollapsed) {
      switch (snappedEdge) {
        case 'left':
          style.left = 0;
          style.top = position.y;
          break;
        case 'right':
          style.right = 0;
          style.top = position.y;
          style.left = 'auto'; // Important: clear left when using right
          break;
        case 'top':
          style.top = 0;
          style.left = position.x;
          break;
        case 'bottom':
          style.bottom = 0;
          style.left = position.x;
          style.top = 'auto'; // Important: clear top when using bottom
          break;
      }
    } else {
      // For expanded state, just use direct positioning
      style.left = position.x;
      style.top = position.y;
    }

    return style;
  };

  return (
    <div
      ref={debugRef}
      className={getContainerClassNames()}
      style={getPositionStyle()}
      onMouseDown={startDrag}
      onTouchStart={startDrag}
    >
      {!isCollapsed ? (
        <>
          <div className={styles.debugHeader}>
            <div className={styles.debugHeaderGrip}></div>
            <h4 className={styles.debugTitle}>Auth Debug</h4>
            <button
              onClick={toggleCollapse}
              className={styles.collapseButton}
              aria-label="Collapse debug panel"
            >
              −
            </button>
          </div>

          <div className={styles.debugContent}>
            <div className={styles.debugRow}>
              <strong>Loading:</strong> {isLoading ? '⏳' : '✅'}
            </div>
            <div className={styles.debugRow}>
              <strong>Wallet Connected:</strong> {isWalletConnected ? '✅' : '❌'}
            </div>
            <div className={styles.debugRow}>
              <strong>Authenticated:</strong> {isAuthenticated ? '✅' : '❌'}
            </div>
            <div className={styles.debugRow}>
              <strong>Allowed:</strong> {isAllowed ? '✅' : '❌'}
            </div>
            <div className={styles.debugRow}>
              <strong>Has Token:</strong> {token ? '✅' : '❌'}
            </div>
            <div className={styles.debugRow}>
              <strong>Has User:</strong> {user ? '✅' : '❌'}
            </div>
            <div className={styles.debugRow}>
              <strong>Address:</strong> {walletAddress || 'none'}
            </div>
            {walletAddress && (
              <div className={styles.debugRow}>
                <strong>Whitelist Check:</strong> {
                  addressAllowed !== null
                    ? addressAllowed ? '✅ Allowed' : '❌ Not allowed'
                    : '⏳ Checking...'
                }
              </div>
            )}
            {token && (
              <div>
                <button
                  onClick={handleRefreshToken}
                  className={styles.refreshButton}
                >
                  Refresh Token
                </button>
              </div>
            )}
            {error && (
              <div className={styles.errorMessage}>
                <strong>Error:</strong> {error}
              </div>
            )}
            <div className={styles.timestamp}>
              Last updated: {currentTime}
            </div>
          </div>
        </>
      ) : (
        <div
          className={styles.collapsedIndicator}
          onClick={toggleCollapse}
        >
          <span className={styles.expandIcon}>+</span>
        </div>
      )}
    </div>
  );
};

export default DebugAuth;
