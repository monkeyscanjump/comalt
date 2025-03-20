"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth';
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import styles from './AccountSelector.module.css';

/**
 * Shows wallet accounts for selection and provides guidance for
 * accessing all accounts in various wallet extensions.
 */
const AccountSelector = () => {
  const { accounts, selectAccount, setShowAccountSelector } = useAuth();
  const [accountsBySource, setAccountsBySource] = useState<Record<string, InjectedAccountWithMeta[]>>({});
  const [showHelp, setShowHelp] = useState(false);

  // Group accounts by extension source
  useEffect(() => {
    if (!accounts || accounts.length === 0) return;

    const grouped = accounts.reduce((result, account) => {
      const source = account.meta.source || 'Unknown';
      if (!result[source]) {
        result[source] = [];
      }
      result[source].push(account);
      return result;
    }, {} as Record<string, InjectedAccountWithMeta[]>);

    setAccountsBySource(grouped);
  }, [accounts]);

  // Handle account selection
  const handleSelectAccount = (account: InjectedAccountWithMeta) => {
    selectAccount(account);
  };

  // Close the modal
  const handleCancel = () => {
    setShowAccountSelector(false);
  };

  // Toggle help instructions
  const toggleHelp = () => {
    setShowHelp(!showHelp);
  };

  console.log('Rendering AccountSelector with accounts:', accounts?.length);
  console.log('Accounts by source:', accountsBySource);

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <h2 className={styles.title}>Select Account</h2>

        {accounts && accounts.length > 0 ? (
          <>
            {/* If we have multiple sources, show them in sections */}
            {Object.keys(accountsBySource).length > 1 ? (
              <>
                {Object.entries(accountsBySource).map(([source, sourceAccounts]) => (
                  <div key={source} className={styles.sourceSection}>
                    <h3 className={styles.sourceTitle}>{source}</h3>
                    <ul className={styles.accountsList}>
                      {sourceAccounts.map((account) => (
                        <li
                          key={account.address}
                          className={styles.accountItem}
                          onClick={() => handleSelectAccount(account)}
                        >
                          <div className={styles.accountName}>
                            {account.meta.name || 'Unnamed Account'}
                          </div>
                          <div className={styles.accountAddress}>
                            {`${account.address.slice(0, 8)}...${account.address.slice(-8)}`}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            ) : (
              // Simple list for single source
              <ul className={styles.accountsList}>
                {accounts.map((account) => (
                  <li
                    key={account.address}
                    className={styles.accountItem}
                    onClick={() => handleSelectAccount(account)}
                  >
                    <div className={styles.accountName}>
                      {account.meta.name || 'Unnamed Account'}
                    </div>
                    <div className={styles.accountAddress}>
                      {`${account.address.slice(0, 8)}...${account.address.slice(-8)}`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className={styles.noAccounts}>
            <p>No accounts found in your wallet</p>
            <button className={styles.helpButton} onClick={toggleHelp}>
              {showHelp ? 'Hide Help' : 'Help'}
            </button>
          </div>
        )}

        {/* Help section with access instructions */}
        {showHelp && (
          <div className={styles.helpSection}>
            <h4>Wallet Access Instructions</h4>

            <div className={styles.walletInstructions}>
              <h5>SubWallet</h5>
              <ol>
                <li>Open the SubWallet extension</li>
                <li>Go to Settings &gt; Manage Website Access</li>
                <li>Find this website in the list</li>
                <li>Select "Allow reading all accounts"</li>
                <li>Refresh this page and try connecting again</li>
              </ol>
            </div>

            <div className={styles.walletInstructions}>
              <h5>Polkadot.js</h5>
              <ol>
                <li>Open the Polkadot.js extension</li>
                <li>Click on the gear icon (settings)</li>
                <li>Enable "Allow authorization for all accounts"</li>
                <li>Find this site in the list and click "Manage website access"</li>
                <li>Select all accounts you want to use</li>
                <li>Refresh this page and try connecting again</li>
              </ol>
            </div>
          </div>
        )}

        <div className={styles.actions}>
          {accounts && accounts.length === 0 && showHelp && (
            <button
              className={styles.refreshButton}
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
          )}
          <button
            className={styles.cancelButton}
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountSelector;
