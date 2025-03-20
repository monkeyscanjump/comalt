"use client";

import React from 'react';
import { useAuth } from '@/contexts/auth';
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import styles from './AccountSelector.module.css';

const AccountSelector = () => {
  const { accounts, selectAccount, setShowAccountSelector } = useAuth();

  const handleSelectAccount = (account: InjectedAccountWithMeta) => {
    selectAccount(account);
  };

  const handleCancel = () => {
    setShowAccountSelector(false);
  };

  console.log('Rendering AccountSelector with accounts:', accounts?.length);

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <h2 className={styles.title}>Select Account</h2>

        {accounts && accounts.length > 0 ? (
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
                  {account.address}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.noAccounts}>No accounts found in your wallet</p>
        )}

        <div className={styles.actions}>
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
