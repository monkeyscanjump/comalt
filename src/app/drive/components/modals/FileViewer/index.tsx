import React, { useEffect, useState } from 'react';
import { FiDownload, FiX, FiFolder, FiFile, FiExternalLink } from 'react-icons/fi';
import styles from './FileViewer.module.css';
import pageStyles from '@/styles/pages.module.css';
import { NetworkType } from '../../../types';
import { useClickOutside } from '@/hooks/useClickOutside';
import { LoadingState } from '@/components/LoadingState';
import { getFileInfo, getDownloadUrl } from '../../../utils/fileUtils';
import { formatFileSize, formatDate } from '../../../utils/formatUtils';
import Image from 'next/image';

interface FileViewerProps {
  file: {
    name: string;
    url: string;
    type: string;
    headCid: string;
    size: number;
    createdAt?: string;
    updatedAt?: string;
    isFolder?: boolean;
    files?: any[];
    children?: any[];
  };
  onClose: () => void;
  network: NetworkType;
  fetchFileMetadata: (cid: string) => Promise<any>;
}

export const FileViewer: React.FC<FileViewerProps> = ({
  file,
  onClose,
  network,
  fetchFileMetadata
}) => {
  const { name, url, type, headCid, size } = file;
  const [folderContents, setFolderContents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Record<string, any>>({});
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isMetadataLoading, setIsMetadataLoading] = useState(true);
  const [textContent, setTextContent] = useState<string>('');
  const [isTextLoading, setIsTextLoading] = useState(false);

  // Use the click outside hook to close the modal when clicking outside
  const modalRef = useClickOutside<HTMLDivElement>(onClose);

  // Basic folder detection
  const isFolder = file.isFolder || type === 'folder' || type === 'directory';

  // Get file info containing extension, config file status, and viewer type
  const { fileExtension, isConfigFile, displayExtension, viewerType } = getFileInfo(name, type, isFolder);

  // Load metadata immediately when component mounts
  useEffect(() => {
    const loadMetadata = async () => {
      if (!headCid) return;

      setIsMetadataLoading(true);
      try {
        const data = await fetchFileMetadata(headCid);
        if (data) {
          setMetadata(data);
        }
      } catch (err) {
        console.error('Error loading metadata in FileViewer:', err);
      } finally {
        setIsMetadataLoading(false);
      }
    };

    loadMetadata();
  }, [headCid, fetchFileMetadata]);

  // Load text content for text or config files
  useEffect(() => {
    if (viewerType !== 'text' && viewerType !== 'code') {
      return;
    }

    setIsTextLoading(true);

    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch text content: ${response.statusText}`);
        }
        return response.text();
      })
      .then(content => {
        setTextContent(content);
      })
      .catch(err => {
        console.error('Error fetching text content:', err);
        setTextContent(`Failed to load content: ${err.message}`);
      })
      .finally(() => {
        setIsTextLoading(false);
      });
  }, [url, viewerType]);

  // Load folder contents if this is a folder
  useEffect(() => {
    if (!isFolder) {
      setIsLoading(false);
      return;
    }

    // First check if children or files are already provided in the props
    if (file.children && Array.isArray(file.children) && file.children.length > 0) {
      setFolderContents(file.children);
      setIsLoading(false);
      return;
    }

    if (file.files && Array.isArray(file.files) && file.files.length > 0) {
      setFolderContents(file.files);
      setIsLoading(false);
      return;
    }

    // If no files/children in props, use the folders API
    setIsLoading(true);
    setError(null);

    fetch(`/api/drive/files/${headCid}/info?network=${network}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch folder info: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        // Check if we got folder children array from the API
        if (data.children && Array.isArray(data.children) && data.children.length > 0) {
          setFolderContents(data.children);
        } else if (data.contents && Array.isArray(data.contents) && data.contents.length > 0) {
          setFolderContents(data.contents);
        } else {
          setFolderContents([]);
        }
      })
      .catch(err => {
        console.error('Error fetching folder contents:', err);
        setError(`Failed to load folder contents: ${err.message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [file, isFolder, headCid, name, network]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div className={styles.fileViewerOverlay}>
      <div
        ref={modalRef}
        className={styles.fileViewerModal}
      >
        <div className={styles.fileViewerHeader}>
          <div className={styles.fileInfo}>
            <h3 className={styles.fileName}>
              {isFolder && <FiFolder className={styles.folderIcon} />}
              {name}
            </h3>
            <span className={styles.fileType}>
              {isFolder ? 'Folder' : isConfigFile ? 'Configuration File' : displayExtension} • {formatFileSize(size)} • {network}
            </span>
          </div>
          <div className={styles.fileViewerActions}>
            {!isFolder && (
              <a
                href={url}
                download={name}
                className={pageStyles.buttonPrimary}
              >
                <FiDownload /> Download
              </a>
            )}
            <button
              onClick={onClose}
              className={styles.closeButton}
              aria-label="Close"
            >
              <FiX />
            </button>
          </div>
        </div>

        <div className={styles.fileViewerContent}>
          <div className={styles.fileViewerMainContent}>
            {/* Image file viewer */}
            {viewerType === 'image' && (
              <div className={styles.imageContainer}>
                {isImageLoading && (
                  <div className={styles.imageLoading}>
                    <LoadingState message="Loading image..." />
                  </div>
                )}
                <Image
                  src={url}
                  alt={name}
                  className={styles.imageViewer}
                  onLoad={() => setIsImageLoading(false)}
                  onError={() => setIsImageLoading(false)}
                  style={{ display: isImageLoading ? 'none' : 'block' }}
                  width={800}
                  height={600}
                  priority={true}
                  unoptimized={url.startsWith('blob:') || url.startsWith('data:')}
                />
              </div>
            )}

            {/* Folder contents view */}
            {viewerType === 'folder' && (
              <div className={styles.folderContainer}>
                {isLoading ? (
                  <div className={styles.folderLoading}>
                    <LoadingState message="Loading folder contents..." />
                  </div>
                ) : error ? (
                  <div className={styles.folderError}>{error}</div>
                ) : folderContents.length > 0 ? (
                  <div className={styles.folderFileList}>
                    {folderContents.map((folderFile, index) => {
                      // Handle various property names that might be in the data
                      const fileId = folderFile.cid || folderFile.headCid || `file-${index}`;
                      const fileName = folderFile.name || folderFile.cleanName || `File ${index + 1}`;
                      const fileSize = folderFile.size || folderFile.totalSize || 0;
                      // Pass the filename to the download URL function
                      const downloadUrl = getDownloadUrl(fileId, fileName, network);

                      return (
                        <div key={fileId} className={styles.folderFileItem}>
                          <div className={styles.folderFileInfo}>
                            <FiFile className={styles.folderFileIcon} />
                            <span className={styles.folderFileName}>
                              {fileName}
                            </span>
                            <span className={styles.folderFileSize}>
                              {formatFileSize(fileSize)}
                            </span>
                          </div>
                          <div className={styles.folderFileActions}>
                            <a
                              href={downloadUrl}
                              download={fileName}
                              className={styles.folderFileDownload}
                              title="Download file"
                            >
                              <FiDownload />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.folderEmpty}>
                    <p>No files found in this folder.</p>
                  </div>
                )}
              </div>
            )}

            {/* Text file viewer - handles both config files and regular text files */}
            {(viewerType === 'text' || viewerType === 'code') && (
              <div className={styles.textContainer}>
                {isTextLoading ? (
                  <div className={styles.textLoading}>
                    <LoadingState message="Loading text content..." />
                  </div>
                ) : (
                  <pre className={styles.textContent}>
                    {textContent || 'No content available'}
                  </pre>
                )}
              </div>
            )}

            {/* Simple preview for other file types */}
            {viewerType !== 'image' &&
             viewerType !== 'folder' &&
             viewerType !== 'text' &&
             viewerType !== 'code' && (
              <div className={styles.filePreview}>
                <div className={styles.fileIcon}>
                  {isConfigFile ? 'CFG' : displayExtension || '?'}
                </div>
                <p>Preview not available for this file type</p>
                {isConfigFile && (
                  <p className={styles.fileNote}>
                    This appears to be a configuration file ({name})
                  </p>
                )}
              </div>
            )}
          </div>

          {/* File metadata section */}
          <div className={styles.fileMetadata}>
            <h4>File Details</h4>
            {isMetadataLoading ? (
              <div className={styles.metadataLoading}>
                <LoadingState message="Loading metadata..." />
              </div>
            ) : (
              <div className={styles.metadataGrid}>
                <div className={styles.metadataItem}>
                  <span className={styles.metadataLabel}>Name:</span>
                  <span className={styles.metadataValue}>{name}</span>
                </div>
                <div className={styles.metadataItem}>
                  <span className={styles.metadataLabel}>Size:</span>
                  <span className={styles.metadataValue}>{formatFileSize(size)}</span>
                </div>
                <div className={styles.metadataItem}>
                  <span className={styles.metadataLabel}>Type:</span>
                  <span className={styles.metadataValue}>
                    {isConfigFile ? 'Configuration File' : (type || displayExtension)}
                  </span>
                </div>
                <div className={styles.metadataItem}>
                  <span className={styles.metadataLabel}>Created:</span>
                  <span className={styles.metadataValue}>{formatDate(file.createdAt)}</span>
                </div>
                <div className={styles.metadataItem}>
                  <span className={styles.metadataLabel}>CID:</span>
                  <span className={styles.metadataValue}>{headCid}</span>
                </div>
                {/* Conditionally show additional metadata if available */}
                {metadata && Object.keys(metadata).map(key => {
                  // Skip some common fields that are already displayed
                  if (['name', 'size', 'type', 'headCid'].includes(key)) return null;

                  return (
                    <div key={key} className={styles.metadataItem}>
                      <span className={styles.metadataLabel}>{key}:</span>
                      <span className={styles.metadataValue}>
                        {typeof metadata[key] === 'object'
                          ? JSON.stringify(metadata[key])
                          : String(metadata[key])}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
