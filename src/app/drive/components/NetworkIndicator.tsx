import React from 'react';
import { FiServer } from 'react-icons/fi';
import styles from '../drive.module.css';

interface NetworkIndicatorProps {
  network: 'mainnet' | 'testnet';
}

export const NetworkIndicator: React.FC<NetworkIndicatorProps> = ({ network }) => {
  return (
    <div className={styles.networkIndicator}>
      <FiServer className={styles.networkIcon} />
      <span className={styles.networkLabel}>
        {network === 'mainnet' ? 'Mainnet' : 'Testnet (Taurus)'}
      </span>
    </div>
  );
};
