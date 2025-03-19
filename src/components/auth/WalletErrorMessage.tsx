import React from 'react';
import styles from './AuthComponents.module.css';

interface WalletErrorMessageProps {
  attemptKey?: number;
  isRejection: boolean;
  isRecoveryMode: boolean;
}

export function WalletErrorMessage({
  attemptKey = 0,
  isRejection,
  isRecoveryMode
}: WalletErrorMessageProps) {
  // No message should be displayed if none of the error conditions are true
  if (!isRejection && !isRecoveryMode) {
    return null;
  }

  return (
    <div className={isRejection ? styles.rejectionMessage : styles.recoveryMessage}>
      {/* Rejection message content */}
      {isRejection && (
        <>
          <p>⚠️ <strong>You rejected the signature request</strong></p>
          <p>You need to approve the signature in your wallet to continue.</p>
          <p style={{ fontSize: '14px', marginTop: '5px' }}>
            Please try again by clicking the button below.
          </p>
        </>
      )}

      {/* Recovery message content */}
      {isRecoveryMode && (
        <>
          <p><strong>⚠️ Wallet Extension Issue Detected</strong></p>
          <p style={{ marginTop: '5px' }}>
            It looks like a signature request was interrupted. Please try these steps:
          </p>
          <ol className={styles.recoverySteps}>
            <li>Check your wallet extension for pending requests and reject them</li>
            <li>Make sure your wallet is unlocked</li>
            <li>Try the "Reset Connection" button below</li>
          </ol>
        </>
      )}
    </div>
  );
}
