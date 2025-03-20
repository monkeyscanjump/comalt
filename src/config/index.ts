import { getPublicEnv, getEnvVariable } from '@/utils/env';

/**
 * Application configuration
 * Gets values from environment variables with fallbacks
 */
export const config = {
  api: {
    baseUrl: getPublicEnv('API_URL', ''),
    polkadotUrl: getEnvVariable('POLKADOT_API_URL', 'https://rpc.polkadot.io')
  },
  app: {
    name: getPublicEnv('APP_NAME', 'comAlt'),
    version: getPublicEnv('APP_VERSION', '1.0.0'),
    environment: getPublicEnv('NODE_ENV', 'development'),
    isProduction: getPublicEnv('NODE_ENV', 'development') === 'production'
  },
  auth: {
    walletAddress: 'wallet-address',
    tokenName: 'auth-token',
    publicModeFlag: 'is-public-mode',
    userData: 'user-data',
    walletName: 'wallet-name'
  }
};

/**
 * Type definition for the config object
 * Makes it easier to use with TypeScript
 */
export type AppConfig = typeof config;
