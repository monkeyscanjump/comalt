import { useState, useCallback } from 'react';
import { NetworkType, DriveFile } from '../types';

interface UseFileSharingProps {
  isAuthenticated: boolean;
  network: NetworkType;
  setFiles: React.Dispatch<React.SetStateAction<DriveFile[]>>;
}

export function useFileSharing({ isAuthenticated, network, setFiles }: UseFileSharingProps) {
  const [selectedCid, setSelectedCid] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle file sharing (create public URL)
  const handleShare = useCallback(async (cid: string) => {
    if (!isAuthenticated) return;

    try {
      setIsSharing(true);
      setSelectedCid(cid);
      setShowShareModal(true);
      setError(null);

      console.log(`Creating public link for file with CID: ${cid} on network: ${network}`);

      // Send share request to our backend
      const response = await fetch(`/api/drive/files/${cid}/share?network=${network}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create public link');
      }

      const data = await response.json();
      console.log('Public link created successfully:', data);

      // Update the file with public URL
      setPublicUrl(data.publicUrl);

      // Update the file in the list
      setFiles(prevFiles => prevFiles.map(file =>
        file.headCid === cid
          ? { ...file, isPublic: true, publicUrl: data.publicUrl }
          : file
      ));

    } catch (err) {
      console.error('Share failed:', err);
      setError(`Failed to create public link: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setShowShareModal(false);
    } finally {
      setIsSharing(false);
    }
  }, [isAuthenticated, network, setFiles]);

  // Copy public URL to clipboard
  const copyToClipboard = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, []);

  // Close share modal
  const closeShareModal = useCallback(() => {
    setShowShareModal(false);
    setSelectedCid(null);
    setPublicUrl(null);
    setCopied(false);
  }, []);

  return {
    selectedCid,
    showShareModal,
    publicUrl,
    isSharing,
    copied,
    error,
    handleShare,
    copyToClipboard,
    closeShareModal
  };
}
