"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth';
import { isAddressAllowedAsync } from '@/config/whitelist';
import { useDraggable } from '@/utils/draggable';
import { FaSignInAlt, FaUser, FaWallet, FaKey, FaInfoCircle, FaSync, FaExclamationTriangle } from 'react-icons/fa';
import styles from './DebugAuth.module.css';

const DebugAuth = () => {
  // State management
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isClient, setIsClient] = useState(false);
  const [addressAllowed, setAddressAllowed] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'details'>('status');
  const debugRef = useRef<HTMLDivElement>(null);

  // Environment check
  const shouldRender = typeof window !== 'undefined' && process.env.NODE_ENV !== 'production';

  // Initial position
  const defaultX = typeof window !== 'undefined' ? Math.max(0, window.innerWidth - 380) : 0;
  const defaultY = typeof window !== 'undefined' ? Math.max(0, window.innerHeight - 450) : 0;

  // Draggable hook
  const { position, isDragging, snappedEdge, startDrag, setPosition } = useDraggable(debugRef, {
    initialPosition: { x: defaultX, y: defaultY },
    persistPosition: true,
    storageKey: 'debugAuth',
    detectEdges: true,
    ignoreDragSelectors: [`.${styles.collapseButton}`, `.${styles.collapsedIndicator}`, `.${styles.tabButton}`,
                          `.${styles.refreshButton}`, `.${styles.tabContent}`],
    targetFps: 30,
    safetyMargin: 20
  });

  // Auth context
  const {
    isAuthenticated,
    isAllowed,
    isWalletConnected,
    walletAddress,
    error,
    token,
    user,
    isLoading,
    refreshAuthToken,
    isPublicMode
  } = useAuth();

  // Track collapse state changes
  useEffect(() => {
    if (!isCollapsed) {
      // Reference to debug panel element
      const panel = debugRef.current;
      if (!panel) return;

      // Add transition class
      panel.classList.add(styles.smoothTransition);

      requestAnimationFrame(() => {
        // Calculate viewport boundaries
        const rect = panel.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const safetyMargin = 20;

        let newX = position.x;
        let newY = position.y;
        let needsUpdate = false;

        // Check boundaries
        if (rect.right > viewportWidth - safetyMargin) {
          newX = Math.max(safetyMargin, viewportWidth - rect.width - safetyMargin);
          needsUpdate = true;
        }
        if (rect.bottom > viewportHeight - safetyMargin) {
          newY = Math.max(safetyMargin, viewportHeight - rect.height - safetyMargin);
          needsUpdate = true;
        }
        if (rect.left < safetyMargin) {
          newX = safetyMargin;
          needsUpdate = true;
        }
        if (rect.top < safetyMargin) {
          newY = safetyMargin;
          needsUpdate = true;
        }

        if (needsUpdate) {
          setPosition({ x: newX, y: newY });
        }

        setTimeout(() => {
          if (panel) {
            panel.classList.remove(styles.smoothTransition);
          }
        }, 150);
      });
    }
  }, [isCollapsed, position.x, position.y, setPosition]);

  // Check if address is allowed
  useEffect(() => {
    if (!walletAddress) {
      setAddressAllowed(null);
      return;
    }

    let mounted = true;
    const checkAddress = async () => {
      try {
        const isAllowed = await isAddressAllowedAsync(walletAddress);
        if (mounted) setAddressAllowed(isAllowed);
      } catch (error) {
        if (mounted) setAddressAllowed(false);
      }
    };

    checkAddress();
    return () => { mounted = false; };
  }, [walletAddress]);

  // Client-side effects
  useEffect(() => {
    setIsClient(true);
    setCurrentTime(new Date().toLocaleTimeString());

    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 5000);

    try {
      const savedCollapsed = localStorage.getItem('debugAuthCollapsed');
      if (savedCollapsed) setIsCollapsed(JSON.parse(savedCollapsed));

      const savedTab = localStorage.getItem('debugAuthTab');
      if (savedTab) setActiveTab(savedTab as 'status' | 'details');
    } catch (e) {
      console.error('Failed to load debug panel state:', e);
    }

    return () => clearInterval(timer);
  }, []);

  // Save panel state
  useEffect(() => {
    if (isClient) {
      localStorage.setItem('debugAuthCollapsed', JSON.stringify(isCollapsed));
      localStorage.setItem('debugAuthTab', activeTab);
    }
  }, [isCollapsed, activeTab, isClient]);

  if (!shouldRender || !isClient) return null;

  // Refresh token handler
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

  // Toggle collapse
  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
  };

  // Class names
  const getContainerClassNames = () => {
    const classNames = [styles.debugContainer];

    if (debugRef.current?.classList.contains(styles.smoothTransition)) {
      classNames.push(styles.smoothTransition);
    }

    classNames.push(isDragging ? styles.debugDragging : styles.debugNormal);

    if (!isCollapsed) {
      classNames.push(styles.debugExpandedContent);
    } else {
      switch (snappedEdge) {
        case 'left': classNames.push(styles.leftEdge); break;
        case 'right': classNames.push(styles.rightEdge); break;
        case 'top': classNames.push(styles.topEdge); break;
        case 'bottom': classNames.push(styles.bottomEdge); break;
      }

      if (snappedEdge === 'left' || snappedEdge === 'right') {
        classNames.push(styles.horizontalCollapsed);
      } else {
        classNames.push(styles.verticalCollapsed);
      }
    }

    return classNames.join(' ');
  };

  // Position styles
  const getPositionStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {};

    if (isCollapsed) {
      switch (snappedEdge) {
        case 'left':
          style.left = 0;
          style.top = position.y;
          break;
        case 'right':
          style.right = 0;
          style.top = position.y;
          style.left = 'auto';
          break;
        case 'top':
          style.top = 0;
          style.left = position.x;
          break;
        case 'bottom':
          style.bottom = 0;
          style.left = position.x;
          style.top = 'auto';
          break;
      }
    } else {
      style.left = position.x;
      style.top = position.y;
    }

    return style;
  };

  // Status indicators
  const getStatusIndicator = (isActive: boolean | null) => {
    if (isActive === null) return <span className={styles.statusPending}></span>;
    return isActive ?
      <span className={styles.statusSuccess}></span> :
      <span className={styles.statusFailed}></span>;
  };

  // Truncate wallet address
  const truncateAddress = (address?: string | null) => {
    if (!address) return 'None';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
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
          <header className={styles.debugHeader}>
            <div className={styles.headerLeft}>
              <div className={styles.debugGrip}>
                <div className={styles.gripDot}></div>
                <div className={styles.gripDot}></div>
                <div className={styles.gripDot}></div>
              </div>
              <h4 className={styles.debugTitle}>
                <span className={styles.debugIcon}>🔍</span> Auth Debug
              </h4>
            </div>
            <button
              onClick={toggleCollapse}
              className={styles.collapseButton}
              aria-label="Collapse debug panel"
            >
              ×
            </button>
          </header>

          <nav className={styles.tabNav}>
            <button
              className={`${styles.tabButton} ${activeTab === 'status' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('status')}
            >
              Status
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'details' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('details')}
            >
              Details
            </button>
          </nav>

          <div className={styles.tabContent}>
            {activeTab === 'status' && (
              <div className={styles.statusTab}>
                <div className={styles.statusGrid}>
                  <div className={styles.statusItem}>
                    <div className={styles.statusIcon}>
                      <FaInfoCircle />
                    </div>
                    <div className={styles.statusDetails}>
                      <span className={styles.statusLabel}>App Mode</span>
                      <div className={styles.statusValue}>
                        {getStatusIndicator(true)}
                        {isPublicMode ? 'Public' : 'Restricted'}
                      </div>
                    </div>
                  </div>

                  <div className={styles.statusItem}>
                    <div className={styles.statusIcon}>
                      <FaWallet />
                    </div>
                    <div className={styles.statusDetails}>
                      <span className={styles.statusLabel}>Wallet Connected</span>
                      <div className={styles.statusValue}>
                        {getStatusIndicator(isWalletConnected)}
                        {isWalletConnected ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>

                  <div className={styles.statusItem}>
                    <div className={styles.statusIcon}>
                      <FaSignInAlt />
                    </div>
                    <div className={styles.statusDetails}>
                      <span className={styles.statusLabel}>Authenticated</span>
                      <div className={styles.statusValue}>
                        {getStatusIndicator(isAuthenticated)}
                        {isAuthenticated ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>

                  <div className={styles.statusItem}>
                    <div className={styles.statusIcon}>
                      <FaKey />
                    </div>
                    <div className={styles.statusDetails}>
                      <span className={styles.statusLabel}>Authorized</span>
                      <div className={styles.statusValue}>
                        {getStatusIndicator(isAllowed)}
                        {isAllowed ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>
                </div>

                {isLoading && (
                  <div className={styles.loadingIndicator}>
                    <div className={styles.spinner}></div>
                    <span>Loading authentication state...</span>
                  </div>
                )}

                {error && (
                  <div className={styles.errorPanel}>
                    <FaExclamationTriangle className={styles.errorIcon} />
                    <div className={styles.errorText}>{error}</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'details' && (
              <div className={styles.detailsTab}>
                <div className={styles.detailsSection}>
                  <h5 className={styles.sectionTitle}>Wallet</h5>
                  <div className={styles.detailItem}>
                    <div className={styles.detailLabel}>Address</div>
                    <div className={styles.detailValue}>
                      {walletAddress ? (
                        <div className={styles.addressBox}>
                          <code>{truncateAddress(walletAddress)}</code>
                          <button
                            className={styles.copyButton}
                            onClick={() => {
                              navigator.clipboard.writeText(walletAddress);
                              alert('Address copied to clipboard');
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      ) : (
                        <span className={styles.nullValue}>Not connected</span>
                      )}
                    </div>
                  </div>
                  {walletAddress && (
                    <div className={styles.detailItem}>
                      <div className={styles.detailLabel}>Whitelist Status</div>
                      <div className={styles.detailValue}>
                        {addressAllowed === null ? (
                          <span className={styles.pendingStatus}>Checking...</span>
                        ) : addressAllowed ? (
                          <span className={styles.allowedStatus}>Allowed</span>
                        ) : (
                          <span className={styles.deniedStatus}>Not allowed</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.detailsSection}>
                  <h5 className={styles.sectionTitle}>User & Token</h5>
                  <div className={styles.detailItem}>
                    <div className={styles.detailLabel}>User</div>
                    <div className={styles.detailValue}>
                      {user ? (
                        <div className={styles.userInfo}>
                          <div>{user.name || 'Unnamed user'}</div>
                          <div className={styles.userId}>ID: {user.id}</div>
                        </div>
                      ) : (
                        <span className={styles.nullValue}>No user</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.detailItem}>
                    <div className={styles.detailLabel}>Token</div>
                    <div className={styles.detailValue}>
                      {token ? (
                        <div className={styles.tokenInfo}>
                          <div className={styles.tokenPresent}>✓ Present</div>
                          <button
                            onClick={handleRefreshToken}
                            className={styles.refreshButton}
                          >
                            <FaSync className={styles.refreshIcon} />
                            Refresh Token
                          </button>
                        </div>
                      ) : (
                        <span className={styles.nullValue}>No token</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.updateTime}>
                  Last updated: {currentTime}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div
          className={styles.collapsedIndicator}
          onClick={toggleCollapse}
          title="Expand Debug Panel"
        >
          <span className={styles.expandIcon}>🔍</span>
        </div>
      )}
    </div>
  );
};

export default DebugAuth;
