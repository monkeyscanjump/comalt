import React from 'react';
import { FiServer, FiZap, FiX, FiShield } from 'react-icons/fi';
import styles from '../drive.module.css';

interface UploadOptions {
  compression: boolean;
  network: 'mainnet' | 'testnet';
}

interface UploadOptionsPanelProps {
  uploadOptions: UploadOptions;
  onClose: () => void;
  onToggleNetwork: (network: 'mainnet' | 'testnet') => void;
  onToggleCompression: () => void;
}

export const UploadOptionsPanel: React.FC<UploadOptionsPanelProps> = ({
  uploadOptions,
  onClose,
  onToggleNetwork,
  onToggleCompression
}) => {
  return (
    <div className={styles.uploadOptionsPanel}>
      <div className={styles.uploadOptionsPanelHeader}>
        <h3>Upload Options</h3>
        <button
          onClick={onClose}
          className={styles.closeButton}
        >
          <FiX />
        </button>
      </div>

      {/* Network selection */}
      <div className={styles.uploadOption}>
        <div className={styles.uploadOptionLabel}>
          <FiServer />
          <span>Blockchain Network</span>
        </div>
        <div className={styles.networkSelector}>
          <button
            className={`${styles.networkButton} ${uploadOptions.network === 'mainnet' ? styles.networkActive : ''}`}
            onClick={() => onToggleNetwork('mainnet')}
          >
            Mainnet
          </button>
          <button
            className={`${styles.networkButton} ${uploadOptions.network === 'testnet' ? styles.networkActive : ''}`}
            onClick={() => onToggleNetwork('testnet')}
          >
            Testnet (Taurus)
          </button>
        </div>
      </div>

      <div className={styles.uploadOption}>
        <div className={styles.uploadOptionLabel}>
          <FiZap />
          <span>Compression</span>
        </div>
        <label className={styles.toggleSwitch}>
          <input
            type="checkbox"
            checked={uploadOptions.compression}
            onChange={onToggleCompression}
          />
          <span className={styles.toggleSlider}></span>
        </label>
      </div>

      <div className={styles.uploadOption}>
        <div className={styles.uploadOptionLabel}>
          <FiShield />
          <span>Encryption</span>
        </div>
        <div className={styles.encryptionInfo}>
          Files are automatically encrypted using a secure server key
        </div>
      </div>
    </div>
  );
};
