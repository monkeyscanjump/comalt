import { NetworkId } from '@autonomys/auto-utils';
import { createAutoDriveApi } from '@autonomys/auto-drive';

export type NetworkType = 'mainnet' | 'testnet';

export const getNetworkId = (network: NetworkType): NetworkId => {
  switch (network) {
    case 'testnet':
      return NetworkId.TAURUS;
    case 'mainnet':
    default:
      return NetworkId.MAINNET;
  }
};

export const NETWORK_LABELS: Record<NetworkType, string> = {
  mainnet: 'Mainnet',
  testnet: 'Testnet (Taurus)'
};

// Create a server-side instance of the drive API
export const getDriveApi = (network = 'mainnet') => {
  const apiKey = process.env.AUTO_DRIVE_KEY;

  if (!apiKey) {
    throw new Error('AUTO_DRIVE_KEY environment variable is not set');
  }

  try {
    // Convert the string network parameter to the NetworkId enum
    const networkId = getNetworkId(network as NetworkType);

    // Convert the NetworkId enum back to the string value expected by createAutoDriveApi
    const apiNetworkParam = networkId === NetworkId.TAURUS ? 'taurus' : 'mainnet';

    console.log(`Creating Auto Drive API client with network: ${network} (${networkId}) => ${apiNetworkParam}`);

    return createAutoDriveApi({
      apiKey,
      // Use the string value instead of the enum
      network: apiNetworkParam,
    });
  } catch (error) {
    console.error('Failed to create Auto Drive API client:', error);
    throw new Error('Failed to initialize blockchain storage client');
  }
};
