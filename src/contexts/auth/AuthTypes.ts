import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import { User } from '@prisma/client';

export interface AuthContextValue {
  // Authentication state
  isAuthenticated: boolean;
  isAllowed: boolean;
  isLoading: boolean;

  // Wallet state
  isWalletConnected: boolean;
  isConnecting: boolean;
  walletAddress: string | null;
  accounts: InjectedAccountWithMeta[];
  selectedAccount: InjectedAccountWithMeta | null;

  // UI state
  error: string | null;
  showAccountSelector: boolean;
  setShowAccountSelector: (show: boolean) => void;

  // User data
  user: User | null;
  token: string | null;

  // Core methods
  logout: () => void;
  connect: () => Promise<boolean>;
  selectAccount: (account: InjectedAccountWithMeta) => Promise<void>;
  signMessage: (message: string, accountOverride?: InjectedAccountWithMeta) => Promise<string | null>;
  refreshAuthToken: () => Promise<boolean>;
  requestSignature: (address: string) => Promise<boolean>;

  // Signature rejection handling
  wasSignatureRejected: boolean;
  isRequestingSignature: boolean;
  resetRejectionState: () => void;

  isPublicMode: boolean;
}

export interface AuthProviderProps {
  children: React.ReactNode;
}
