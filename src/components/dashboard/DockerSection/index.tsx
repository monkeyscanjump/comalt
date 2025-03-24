import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaDocker } from 'react-icons/fa';
import { FiDownload, FiCheck, FiAlertTriangle, FiTerminal, FiExternalLink } from 'react-icons/fi';
import { SectionContainer } from '@/components/dashboard/SectionContainer';
import styles from '@/app/page.module.css';
import dockerStyles from './DockerSection.module.css';
import { DisplayMode } from '@/types/dashboard';

interface DockerSectionProps {
  osInfo: {
    platform: string;
    distro: string;
    release: string;
  } | null | undefined;
  token?: string;
  isCollapsible?: boolean;
  displayMode?: DisplayMode;
}

export const DockerSection: React.FC<DockerSectionProps> = ({
  osInfo,
  token,
  isCollapsible = true,
  displayMode = 'default'
}) => {
  const [dockerInstalled, setDockerInstalled] = useState<boolean | null>(null);
  const [dockerVersion, setDockerVersion] = useState<string | null>(null);
  const [installationStatus, setInstallationStatus] = useState<'not_started' | 'checking' | 'installing' | 'completed' | 'error'>('not_started');
  const [installLog, setInstallLog] = useState<string>('');
  const [dockerError, setDockerError] = useState<string | null>(null);
  const [isDockerLoading, setIsDockerLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Track if Docker data has been loaded
  const dockerDataLoadedRef = useRef(false);

  // Check if Docker is installed
  const checkDockerInstallation = useCallback(async () => {
    try {
      setIsDockerLoading(true);
      setInstallationStatus('checking');

      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        const response = await fetch('/api/docker/status', {
          headers,
          // Add timeout to avoid hanging requests
          signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
          throw new Error(`Docker check failed: ${response.status}`);
        }

        const data = await response.json();
        setDockerInstalled(data.installed);
        setDockerVersion(data.installed ? data.version : null);
        setInstallationStatus(data.installed ? 'completed' : 'not_started');
      } catch (fetchErr) {
        // Handle network errors differently
        console.error('Docker check network error:', fetchErr);

        // Don't fail the whole page for Docker check issues
        setDockerInstalled(false);
        setDockerVersion(null);
        setInstallationStatus('not_started');
      } finally {
        setIsDockerLoading(false);
      }
    } catch (err) {
      console.error('Docker check error:', err);
      setDockerInstalled(false);
      setInstallationStatus('not_started');
      setIsDockerLoading(false);
    }
  }, [token]);

  // Check Docker status when OS info is available
  useEffect(() => {
    if (osInfo && !dockerDataLoadedRef.current) {
      checkDockerInstallation()
        .then(() => {
          dockerDataLoadedRef.current = true;
        })
        .catch(err => {
          console.error('Error checking Docker status:', err);
        });
    }
  }, [osInfo, checkDockerInstallation]);

  // Force refresh of Docker status
  const handleDockerRefresh = () => {
    dockerDataLoadedRef.current = false;
    checkDockerInstallation();
  };

  // Start Docker installation
  const installDocker = async () => {
    try {
      setInstallationStatus('installing');
      setInstallLog('Starting Docker installation...\n');
      setDockerError(null);

      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Start installation process
      const response = await fetch('/api/docker/install', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          platform: osInfo?.platform,
          distro: osInfo?.distro,
          includeCompose: true
        })
      });

      if (!response.ok) {
        throw new Error(`Installation failed: ${response.statusText}`);
      }

      // Start polling for installation status
      const data = await response.json();
      setInstallLog(prev => prev + data.message + '\n');

      // Poll for progress
      pollInstallationProgress();

    } catch (err) {
      setDockerError(`Installation error: ${err instanceof Error ? err.message : String(err)}`);
      setInstallationStatus('error');
    }
  };

  // Poll for installation progress
  const pollInstallationProgress = () => {
    const checkProgress = async () => {
      try {
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/docker/status?progress=true', { headers });
        const data = await response.json();

        // Update log if there's new output
        if (data.log && data.log !== installLog) {
          setInstallLog(data.log);
        }

        // Check status
        if (data.status === 'completed') {
          setInstallationStatus('completed');
          setDockerInstalled(true);
          setDockerVersion(data.version || 'Unknown version');
        } else if (data.status === 'error') {
          throw new Error(data.error || 'Installation failed');
        } else if (data.status === 'installing') {
          // Continue polling if installation is still in progress
          setTimeout(checkProgress, 2000);
        }
      } catch (err) {
        setDockerError(`Error monitoring installation: ${err instanceof Error ? err.message : String(err)}`);
        setInstallationStatus('error');
      }
    };

    // Start polling
    checkProgress();
  };

  // Get Docker installation instructions based on detected OS
  const getDockerInstructions = () => {
    if (!osInfo) return null;

    if (osInfo.platform === 'win32') {
      return (
        <div>
          <h3>Windows Installation</h3>
          <p>Docker Desktop for Windows will be installed, which includes everything you need:</p>
          <ul>
            <li>Docker Engine</li>
            <li>Docker CLI</li>
            <li>Docker Compose</li>
            <li>Kubernetes</li>
          </ul>
          <p><strong>Requirements:</strong> Windows 10/11 64-bit: Pro, Enterprise, or Education</p>
        </div>
      );
    } else if (osInfo.platform === 'darwin') {
      return (
        <div>
          <h3>macOS Installation</h3>
          <p>Docker Desktop for Mac will be installed, which includes:</p>
          <ul>
            <li>Docker Engine</li>
            <li>Docker CLI</li>
            <li>Docker Compose</li>
            <li>Kubernetes</li>
          </ul>
          <p><strong>Requirements:</strong> macOS 10.14 or newer</p>
        </div>
      );
    } else if (osInfo.platform === 'linux') {
      return (
        <div>
          <h3>Linux Installation ({osInfo.distro})</h3>
          <p>We'll install Docker Engine using your distribution's package manager:</p>
          <ul>
            <li>Docker Engine</li>
            <li>containerd</li>
            <li>Docker CLI</li>
            <li>Docker Compose plugin</li>
          </ul>
        </div>
      );
    }

    return (
      <div>
        <h3>Unsupported Platform</h3>
        <p>Docker installation is not supported on this platform: {osInfo.platform}</p>
        <p>Please visit the <a href="https://docs.docker.com/get-docker/" target="_blank" rel="noopener noreferrer">Docker documentation</a> for manual installation instructions.</p>
      </div>
    );
  };

  // For compact display, just show a summary
  if (displayMode === 'compact' && osInfo) {
    return (
      <SectionContainer
        title="Docker"
        icon={FaDocker}
        isFullWidth={true}
        isCollapsible={isCollapsible}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        canRefresh={true}
        isRefreshing={isDockerLoading}
        onRefresh={handleDockerRefresh}
        displayMode={displayMode}
        className={dockerStyles.dockerSection}
      >
        <p className={styles.compactContent}>
          Docker: {dockerInstalled ? `Installed (${dockerVersion})` : 'Not installed'}
        </p>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer
      title="Docker"
      icon={FaDocker}
      isFullWidth={true}
      isCollapsible={isCollapsible}
      isCollapsed={isCollapsed}
      onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      canRefresh={true}
      isRefreshing={isDockerLoading}
      onRefresh={handleDockerRefresh}
      displayMode={displayMode}
      className={dockerStyles.dockerSection}
    >
      {/* Docker error display */}
      {dockerError && (
        <div className={styles.errorBanner}>
          <div className={styles.errorContent}>
            <FiAlertTriangle className={styles.errorIcon} />
            <div className={styles.errorMessage}>
              <p className={styles.errorText}>{dockerError}</p>
            </div>
          </div>
          <button
            onClick={handleDockerRefresh}
            className={styles.retryButton}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Docker status section */}
      <div className={dockerStyles.sectionContent}>
        <div className={dockerStyles.statusContainer}>
          <h3 className={dockerStyles.subheading}>Docker Status</h3>
          {osInfo ? (
            <div>
              <p className={dockerStyles.statusInfo}>
                <span className={dockerStyles.label}>Status:</span>
                {dockerInstalled ? (
                  <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                    <FiCheck /> Installed ({dockerVersion})
                  </span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeWarning}`}>
                    Not installed
                  </span>
                )}
              </p>
              {dockerInstalled && (
                <div>
                  <p>You can use Docker commands in your terminal:</p>
                  <div className={dockerStyles.commandExamples}>
                    docker --version<br />
                    docker ps<br />
                    docker run hello-world
                  </div>

                  {/* Show more details in detailed mode */}
                  {displayMode === 'detailed' && (
                    <div className={styles.detailedInfo}>
                      <h4>Container Management</h4>
                      <p>Common Docker commands:</p>
                      <div className={dockerStyles.commandExamples}>
                        docker images<br />
                        docker pull image:tag<br />
                        docker container ls<br />
                        docker-compose up -d
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p>Loading Docker status...</p>
          )}
        </div>

        {/* Docker Installation section - Only shown if Docker is not installed */}
        {(!dockerInstalled && osInfo) && (
          <div className={dockerStyles.installContainer}>
            <h3 className={dockerStyles.subheading}>Docker Installation</h3>
            {installationStatus === 'installing' ? (
              <div>
                <h4>Installing Docker...</h4>
                <div className={dockerStyles.terminal}>
                  <div className={dockerStyles.terminalHeader}>
                    <FiTerminal /> Installation Log
                  </div>
                  <div className={dockerStyles.terminalContent}>
                    <pre>{installLog}</pre>
                  </div>
                </div>
                <div className={styles.loadingContainer}>
                  <div className={styles.spinner}></div>
                </div>
                <p style={{ textAlign: 'center' }}>Please wait while Docker is being installed...</p>
              </div>
            ) : (
              <>
                <div className={dockerStyles.instructions}>
                  {getDockerInstructions()}
                </div>

                <div className={dockerStyles.actionContainer}>
                  <button
                    className={styles.buttonPrimary}
                    onClick={installDocker}
                    disabled={!osInfo || installationStatus === 'checking'}
                  >
                    <FiDownload className={styles.buttonIconLeft} />
                    Install Docker
                  </button>

                  <a
                    href="https://docs.docker.com/get-docker/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={dockerStyles.manualLink}
                  >
                    <FiExternalLink />
                    Manual installation instructions
                  </a>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </SectionContainer>
  );
};
