import { useState, useCallback, useRef } from 'react';
import { NetworkType } from '../types';

export function useFileMetadata(network: NetworkType) {
  const [fileMetadata, setFileMetadata] = useState<Record<string, any>>({});
  const [loadingMetadata, setLoadingMetadata] = useState<Record<string, boolean>>({});

  // Use a ref to track in-flight requests to prevent duplicate fetches
  const pendingRequests = useRef<Record<string, Promise<any>>>({});

  // Optimized fetch file metadata with request deduplication
  const fetchFileMetadata = useCallback(async (cid: string) => {
    if (!cid) return null;

    // Return cached metadata if already loaded
    if (fileMetadata[cid]) {
      return fileMetadata[cid];
    }

    // If there's already a request in progress for this CID, return that promise
    if (cid in pendingRequests.current) {
      return pendingRequests.current[cid];
    }

    // Create a new request - fixing the Promise anti-pattern
    setLoadingMetadata(prev => ({ ...prev, [cid]: true }));

    // Create and store the promise first to avoid race conditions
    const fetchPromise = fetch(`/api/drive/files/${cid}/info?network=${network}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch metadata: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log(`Metadata received for ${cid}:`, data);

        // Store metadata in state
        setFileMetadata(prev => ({
          ...prev,
          [cid]: data
        }));

        return data;
      })
      .catch(err => {
        console.error(`Error fetching metadata for ${cid}:`, err);
        throw err; // Rethrow to propagate the error
      })
      .finally(() => {
        setLoadingMetadata(prev => ({ ...prev, [cid]: false }));
        // Remove from pending requests when done
        delete pendingRequests.current[cid];
      });

    // Store the promise in pending requests
    pendingRequests.current[cid] = fetchPromise;

    console.log(`Fetching metadata for file (${cid}) on network ${network}`);
    return fetchPromise;
  }, [network, fileMetadata]);

  // Clear metadata when network changes
  const clearMetadata = useCallback(() => {
    setFileMetadata({});
    setLoadingMetadata({});
    pendingRequests.current = {};
  }, []);

  return {
    fileMetadata,
    loadingMetadata,
    fetchFileMetadata,
    clearMetadata
  };
}
