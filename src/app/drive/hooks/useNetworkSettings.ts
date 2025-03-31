import { useState, useEffect, useCallback, useRef } from 'react';
import { NetworkType } from '../types';

// Helper function to get the initial network from localStorage
function getInitialNetwork(): NetworkType {
  if (typeof window !== 'undefined') {
    const savedNetwork = localStorage.getItem('preferredNetwork');
    if (savedNetwork === 'mainnet' || savedNetwork === 'testnet') {
      return savedNetwork as NetworkType;
    }
  }
  return 'mainnet';
}

export function useNetworkSettings() {
  const [network, setNetwork] = useState<NetworkType>(getInitialNetwork);
  const networkRef = useRef(network);

  // Update ref whenever the network changes for use in callbacks
  useEffect(() => {
    networkRef.current = network;
    console.log(`Network set to: ${network}`);
  }, [network]);

  // Handle network toggle
  const toggleNetwork = useCallback((newNetwork: NetworkType) => {
    if (newNetwork === network) return;

    // Save to localStorage for persistence
    localStorage.setItem('preferredNetwork', newNetwork);
    console.log(`Saving network preference to localStorage: ${newNetwork}`);

    // Update network setting
    setNetwork(newNetwork);
  }, [network]);

  return {
    network,
    networkRef,
    toggleNetwork
  };
}
