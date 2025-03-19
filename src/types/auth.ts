import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import { User } from '@prisma/client';

// Add isPublicMode to the AuthContextValue interface
export interface AuthContextValue {
  isAuthenticated: boolean;
  isAllowed: boolean;
  isLoading: boolean;
  isWalletConnected: boolean;
  walletAddress: string | null;
  accounts: InjectedAccountWithMeta[];
  selectedAccount: InjectedAccountWithMeta | null;
  isConnecting: boolean;
  isRequestingSignature: boolean;
  error: string | null;
  user: User | null;
  token: string | null;
  logout: () => Promise<void>;
  connect: () => Promise<void>;
  selectAccount: (account: InjectedAccountWithMeta) => Promise<void>;
  showAccountSelector: boolean;
  setShowAccountSelector: (show: boolean) => void;
  signMessage: (message: string, account?: InjectedAccountWithMeta) => Promise<string | null>;
  refreshAuthToken: () => Promise<boolean>;
  requestSignature: (walletAddress: string) => Promise<boolean>;
  wasSignatureRejected: boolean;
  resetRejectionState: () => void;
  isPublicMode: boolean;
}

export interface TokenPayload {
  sub: string;
  address: string;
  isAdmin: boolean;
  iat?: number;
  exp?: number;
}
