"use client";

import React from 'react';
import { useAuth } from '@/contexts/auth';
import styles from '@/components/auth/AuthComponents.module.css';
import { FaSignature, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';

interface SignatureRequestProps {
  wasRejected?: boolean;
}

export const SignatureRequest = ({ wasRejected }: SignatureRequestProps) => {
  const {
    requestSignature,
    walletAddress,
    error,
    isRequestingSignature,
    resetRejectionState
  } = useAuth();

  const handleRequestSignature = async () => {
    if (walletAddress) {
      // Clear any previous errors before requesting signature again
      resetRejectionState();

      // Request signature
      await requestSignature(walletAddress);
    }
  };

  return (
    <div className={styles.authContainer}>
      <h2 className={styles.authTitle}>
        <FaSignature className={styles.titleIcon} />
        Signature Required
      </h2>

      {wasRejected && !isRequestingSignature ? (
        <div className={styles.rejectionMessage}>
          <FaExclamationTriangle className={styles.warningIcon} />
          <p>You rejected the signature request. To continue, you need to sign the message.</p>
        </div>
      ) : (
        <p className={styles.authDescription}>
          Please sign the message with your wallet to authenticate.
        </p>
      )}

      {/* Only show error message when not in requesting state */}
      {error && !isRequestingSignature && (
        <div className={styles.errorMessage}>
          <p className={styles.errorText}>{error}</p>
        </div>
      )}

      <button
        className={styles.primaryButton}
        onClick={handleRequestSignature}
        disabled={isRequestingSignature}
      >
        {isRequestingSignature ? (
          <>
            <FaSpinner className={styles.spinIcon} />
            Requesting...
          </>
        ) : (
          <>
            <FaSignature className={styles.buttonIcon} />
            Sign with Wallet
          </>
        )}
      </button>
    </div>
  );
}
