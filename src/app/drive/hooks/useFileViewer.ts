import { useState, useCallback } from 'react';
import { DriveFile, NetworkType } from '../types';

interface UseFileViewerProps {
  fetchFileMetadata: (cid: string) => Promise<any>;
  network: NetworkType;
}

export function useFileViewer({ fetchFileMetadata, network }: UseFileViewerProps) {
  const [viewingFile, setViewingFile] = useState<DriveFile | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // Handle view file with metadata fetching
  const handleViewFile = useCallback(async (file: DriveFile) => {
    setViewingFile(file);

    // Metadata will be fetched within the FileViewer component
    // No need to preload it here anymore
  }, []);

  return {
    viewingFile,
    setViewingFile,
    isLoadingMetadata,
    handleViewFile
  };
}
