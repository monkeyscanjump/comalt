"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { useAuth } from '@/contexts/auth';
import { FiServer, FiPlus, FiRefreshCw, FiTrash, FiEdit } from 'react-icons/fi';
import pageStyles from '@/styles/pages.module.css';
import styles from './devices.module.css';

// Define types
interface Device {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  apiKey: string;
  isMain: boolean;
  isActive: boolean;
  lastSeen: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function DevicesPage() {
  const { token } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    ipAddress: '',
    port: 3000
  });

  // Fetch all devices - use useCallback to prevent recreation on every render
  const fetchDevices = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch devices from API
      const response = await fetch('/api/devices', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch devices: ${response.status}`);
      }

      const data = await response.json();

      // Get the main device if not already included
      if (!data.some((d: Device) => d.isMain)) {
        try {
          const currentResponse = await fetch('/api/devices/current', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });

          if (currentResponse.ok) {
            const currentDevice = await currentResponse.json();
            data.unshift(currentDevice);
          }
        } catch (err) {
          console.error('Failed to fetch current device:', err);
        }
      }

      setDevices(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching devices:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Add a new device - wrap in useCallback for consistency
  const addDevice = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to add device: ${response.status}`);
      }

      // Reset form
      setFormData({ name: '', ipAddress: '', port: 3000 });
      setShowForm(false);

      // Refresh the device list
      await fetchDevices();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error adding device:', err);
    } finally {
      setLoading(false);
    }
  }, [token, formData, fetchDevices]);

  // Load devices when component mounts or token changes
  useEffect(() => {
    if (token) {
      fetchDevices();
    }
  }, [token, fetchDevices]);

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <PageWrapper title="Devices" showInNav={true} order={3}>
      <div className={pageStyles.container}>
        <div className={pageStyles.header}>
          <h1 className={pageStyles.title}>
            <FiServer className={pageStyles.titleIcon} />
            Remote Devices
          </h1>
          <div className={pageStyles.actions}>
            <button
              onClick={() => setShowForm(true)}
              className={pageStyles.buttonPrimary}
              disabled={loading}
            >
              <FiPlus className={pageStyles.buttonIconLeft} />
              Add Device
            </button>
            <button
              onClick={fetchDevices}
              className={pageStyles.buttonSecondary}
              disabled={loading}
            >
              <FiRefreshCw className={`${pageStyles.buttonIconLeft} ${loading ? pageStyles.spinning : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className={pageStyles.error}>
            <p>{error}</p>
            <button onClick={() => setError(null)} className={pageStyles.closeButton}>
              &times;
            </button>
          </div>
        )}

        {/* Add device form */}
        {showForm && (
          <div className={pageStyles.formContainer}>
            <h2>Add New Device</h2>
            <form onSubmit={addDevice}>
              <div className={pageStyles.formGroup}>
                <label htmlFor="name">Device Name</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  placeholder="e.g., Server Room Pi"
                />
              </div>

              <div className={pageStyles.formGroup}>
                <label htmlFor="ipAddress">IP Address</label>
                <input
                  id="ipAddress"
                  type="text"
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({...formData, ipAddress: e.target.value})}
                  required
                  placeholder="e.g., 192.168.1.100"
                />
              </div>

              <div className={pageStyles.formGroup}>
                <label htmlFor="port">Port</label>
                <input
                  id="port"
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({...formData, port: parseInt(e.target.value) || 3000})}
                  required
                  min="1"
                  max="65535"
                />
              </div>

              <div className={pageStyles.formActions}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className={pageStyles.buttonSecondary}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={pageStyles.buttonPrimary}
                  disabled={loading}
                >
                  Add Device
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Devices list */}
        <div className={styles.devicesList}>
          {loading && devices.length === 0 ? (
            <div className={pageStyles.loading}>Loading devices...</div>
          ) : devices.length === 0 ? (
            <div className={pageStyles.empty}>
              No devices registered. Add your first device.
            </div>
          ) : (
            <div className={pageStyles.table}>
              <div className={`${pageStyles.tableHeader} ${styles.deviceTableHeader}`}>
                <div>Status</div>
                <div>Name</div>
                <div>IP Address</div>
                <div>Port</div>
                <div>Last Seen</div>
                <div>Actions</div>
              </div>

              {devices.map((device) => (
                <div className={`${pageStyles.tableRow} ${styles.deviceTableRow}`} key={device.id}>
                  <div>
                    <span className={`${pageStyles.status} ${device.isActive ? pageStyles.statusSuccess : pageStyles.statusError}`}>
                      {device.isActive ? 'Online' : 'Offline'}
                    </span>
                    {device.isMain && (
                      <span className={pageStyles.badge}>Current</span>
                    )}
                  </div>
                  <div>{device.name}</div>
                  <div>{device.ipAddress}</div>
                  <div>{device.port}</div>
                  <div>{formatDate(device.lastSeen)}</div>
                  <div className={pageStyles.actions}>
                    {!device.isMain && (
                      <>
                        <button className={pageStyles.buttonIcon} title="Edit">
                          <FiEdit />
                        </button>
                        <button className={pageStyles.buttonIcon} title="Delete">
                          <FiTrash />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
