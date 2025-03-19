"use client";

import React from 'react';
import { useAuth } from '@/contexts/auth';
import styles from './SignatureRequest.module.css';

interface SignatureRequestProps {
  wasRejected?: boolean;
}

export const SignatureRequest = ({ wasRejected }: SignatureRequestProps) => {
  const { requestSignature, walletAddress, error, isRequestingSignature } = useAuth();

  const handleRequestSignature = async () => {
    if (walletAddress) {
      await requestSignature(walletAddress);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>Signature Required</h2>

        {wasRejected ? (
          <div className={styles.rejectedMessage}>
            <p>You rejected the signature request. To continue, you need to sign the message.</p>
          </div>
        ) : (
          <p className={styles.info}>
            Please sign the message with your wallet to authenticate.
          </p>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <button
          className={styles.signButton}
          onClick={handleRequestSignature}
          disabled={isRequestingSignature}
        >
          {isRequestingSignature ? 'Requesting...' : 'Sign with Wallet'}
        </button>
      </div>
    </div>
  );
};
