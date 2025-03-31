"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { LoadingState } from '@/components/LoadingState';
import { FileViewer } from './components/modals/FileViewer';
import { FileList } from './components/FileList';
import { UploadOptionsPanel } from './components/UploadOptionsPanel';
import { UploadProgress } from './components/UploadProgress';
import { SearchBar } from './components/SearchBar';
import { NetworkIndicator } from './components/NetworkIndicator';
import { ShareModal } from './components/modals/ShareModal';
import { UploadModal } from './components/modals/UploadModal';
import {
  FiHardDrive,
  FiRefreshCw,
  FiUpload,
  FiAlertTriangle,
  FiSettings,
} from 'react-icons/fi';
import pageStyles from '@/styles/pages.module.css';

// Import types and hooks
import { formatFileSize } from './utils/formatUtils';
import { useNetworkSettings } from './hooks/useNetworkSettings';
import { useFileManagement } from './hooks/useFileManagement';
import { useFileMetadata } from './hooks/useFileMetadata';
import { useFileSharing } from './hooks/useFileSharing';
import { useFileUpload } from './hooks/useFileUpload';
import { useFileViewer } from './hooks/useFileViewer';

export default function DrivePage() {
  const { isAuthenticated } = useAuth();
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Network settings
  const { network, toggleNetwork } = useNetworkSettings();

  // File management
  const {
    files,
    setFiles,
    isLoading,
    error,
    setError,
    hasMore,
    searchQuery,
    fetchFiles,
    handleDelete,
    handleSearchChange,
    loadMoreFiles
  } = useFileManagement({
    isAuthenticated,
    network
  });

  // File metadata
  const {
    fileMetadata,
    loadingMetadata,
    fetchFileMetadata,
    clearMetadata
  } = useFileMetadata(network);

  // File sharing
  const {
    showShareModal,
    publicUrl,
    isSharing,
    copied,
    handleShare,
    copyToClipboard,
    closeShareModal
  } = useFileSharing({
    isAuthenticated,
    network,
    setFiles
  });

  // File viewer
  const {
    viewingFile,
    setViewingFile,
    handleViewFile
  } = useFileViewer({
    fetchFileMetadata,
    network
  });

  // File upload - note we use all the capabilities from the hook
  const {
    isUploading,
    uploadProgress,
    uploadOptions,
    showUploadOptions,
    fileInputRef,
    toggleUploadOptions,
    toggleCompression,
    handleUpload,
    handleUploadFolder
  } = useFileUpload({
    isAuthenticated,
    network,
    refreshFiles: () => fetchFiles(0)
  });

  // Open/close upload modal
  const openUploadModal = () => setShowUploadModal(true);
  const closeUploadModal = () => setShowUploadModal(false);

  // Load files when component mounts or network changes
  useEffect(() => {
    if (isAuthenticated) {
      console.log('Loading files - network is:', network);
      // Always fetch page 0 when network changes
      fetchFiles(0);
      // Clear metadata cache when changing networks
      clearMetadata();
    }
  }, [isAuthenticated, fetchFiles, network, clearMetadata]);

  // If still loading with no files, show loading state
  if (isLoading && files.length === 0) {
    return (
      <PageWrapper title="Drive" showInNav={true} order={4}>
        <div className={pageStyles.container}>
          <div className={pageStyles.header}>
            <h1 className={pageStyles.title}>
              <FiHardDrive className={pageStyles.titleIcon} />
              Blockchain Drive
            </h1>
          </div>
          <LoadingState message={`Loading blockchain files from ${network}...`} />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Drive" showInNav={true} order={4}>
      <div className={pageStyles.container}>
        <div className={pageStyles.header}>
          <div className={pageStyles.titleContainer}>
            <h1 className={pageStyles.title}>
              <FiHardDrive className={pageStyles.titleIcon} />
              Blockchain Drive
            </h1>
            <span className={pageStyles.subtitle}>
              Securely store and manage files on the blockchain
            </span>
          </div>

          <div className={pageStyles.actions}>
            <button
              onClick={toggleUploadOptions}
              className={pageStyles.buttonTertiary}
              title="Upload options"
            >
              <FiSettings className={pageStyles.buttonIconLeft} />
              Options
            </button>

            <button
              onClick={openUploadModal}
              className={pageStyles.buttonPrimary}
              disabled={isUploading}
            >
              <FiUpload className={pageStyles.buttonIconLeft} />
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>

            <button
              onClick={() => fetchFiles(0)}
              className={pageStyles.buttonSecondary}
              disabled={isLoading}
            >
              <FiRefreshCw className={`${pageStyles.buttonIconLeft} ${isLoading ? pageStyles.spinning : ''}`} />
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Upload Options Panel */}
        {showUploadOptions && (
          <UploadOptionsPanel
            uploadOptions={{ ...uploadOptions, network }}
            onClose={toggleUploadOptions}
            onToggleNetwork={toggleNetwork}
            onToggleCompression={toggleCompression}
          />
        )}

        {/* Upload Progress */}
        {isUploading && (
          <UploadProgress progress={uploadProgress} />
        )}

        {/* Error display */}
        {error && (
          <div className={pageStyles.error}>
            <div className={pageStyles.errorContent}>
              <FiAlertTriangle className={pageStyles.errorIcon} />
              <div className={pageStyles.errorMessage}>
                <p className={pageStyles.errorText}>{error}</p>
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className={pageStyles.closeButton}
            >
              &times;
            </button>
          </div>
        )}

        {/* Network indicator */}
        <NetworkIndicator network={network} />

        {/* Search bar */}
        <SearchBar
          value={searchQuery}
          onChange={handleSearchChange}
        />

        {/* Files display - list view only */}
        <FileList
          files={files}
          isLoading={isLoading}
          hasMore={hasMore}
          fileMetadata={fileMetadata}
          loadingMetadata={loadingMetadata}
          onLoadMore={loadMoreFiles}
          onViewFile={handleViewFile}
          onShareFile={handleShare}
          onDeleteFile={handleDelete}
          formatFileSize={formatFileSize}
          network={network}
        />

        {/* Share Modal */}
        <ShareModal
          isOpen={showShareModal}
          isSharing={isSharing}
          publicUrl={publicUrl}
          copied={copied}
          onClose={closeShareModal}
          onCopy={copyToClipboard}
        />

        {/* File Viewer */}
        {viewingFile && (
          <FileViewer
            file={viewingFile}
            onClose={() => setViewingFile(null)}
            network={network}
            fetchFileMetadata={fetchFileMetadata}
          />
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <UploadModal
            onClose={closeUploadModal}
            onUploadFile={handleUpload}
            onUploadFolder={handleUploadFolder}
            isUploading={isUploading}
            uploadOptions={{
              compression: uploadOptions.compression,
              network
            }}
          />
        )}
      </div>
    </PageWrapper>
  );
}
