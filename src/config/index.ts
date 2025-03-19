import { getPublicEnv, getEnvVariable } from '@/utils/env';
import { WALLET_CONSTANTS, APP_CONSTANTS } from './constants';

export const config = {
  api: {
    baseUrl: getPublicEnv('API_URL', ''),
    polkadotUrl: getEnvVariable('POLKADOT_API_URL', 'https://rpc.polkadot.io')
  },
  wallet: {
    storageKey: WALLET_CONSTANTS.STORAGE_KEY,
    jsonPath: WALLET_CONSTANTS.JSON_PATH,
  },
  app: {
    name: getPublicEnv('APP_NAME', APP_CONSTANTS.APP_NAME),
    version: getPublicEnv('APP_VERSION', APP_CONSTANTS.VERSION),
  }
};
