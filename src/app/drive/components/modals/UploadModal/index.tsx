import React, { useState, useRef, useCallback } from 'react';
import { FiX, FiUpload, FiFolder, FiFile, FiArrowUp, FiLock, FiUnlock } from 'react-icons/fi';
import styles from './UploadModal.module.css';
import pageStyles from '@/styles/pages.module.css';
import { useClickOutside } from '@/hooks/useClickOutside';
import { NetworkType } from '@/app/drive/types';

// Define custom attributes for input element
interface ExtendedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  directory?: string;
  webkitdirectory?: string;
}

// Define WebKit File System Entry types
interface WebKitFileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file(
    successCallback: (file: File) => void,
    errorCallback?: (error: Error) => void
  ): void;
  createReader(): WebKitFileSystemDirectoryReader;
}

interface WebKitFileSystemDirectoryReader {
  readEntries(
    successCallback: (entries: WebKitFileSystemEntry[]) => void,
    errorCallback?: (error: Error) => void
  ): void;
}

interface DraggedItem {
  file: File;
  isFolder: boolean;
}

interface UploadModalProps {
  onClose: () => void;
  onUploadFile: (file: File, options?: { encryption?: boolean }) => void;
  onUploadFolder: (files: File[], folderName: string, options?: { encryption?: boolean }) => void;
  isUploading: boolean;
  uploadOptions: {
    compression: boolean;
    network: NetworkType;
  };
}

export const UploadModal: React.FC<UploadModalProps> = ({
  onClose,
  onUploadFile,
  onUploadFolder,
  isUploading,
  uploadOptions
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItems, setDraggedItems] = useState<DraggedItem[]>([]);
  const [enableEncryption, setEnableEncryption] = useState(true); // Default to true - encryption enabled
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useClickOutside<HTMLDivElement>(onClose);

  // Toggle encryption setting
  const handleToggleEncryption = () => {
    setEnableEncryption(prev => !prev);
  };

  // Process files from a directory entry recursively
  const processDirectoryEntry = useCallback(async (
    entry: WebKitFileSystemEntry,
    folderPath = ''
  ): Promise<File[]> => {
    const files: File[] = [];

    if (entry.isFile) {
      return new Promise<File[]>((resolve) => {
        entry.file((file: File) => {
          // Create a new file with the full path
          const newFile = new File(
            [file],
            `${folderPath}${entry.name}`,
            { type: file.type }
          );
          files.push(newFile);
          resolve(files);
        });
      });
    }

    if (entry.isDirectory) {
      const reader = entry.createReader();

      // Read all entries in the directory
      const readEntries = async (): Promise<File[]> => {
        return new Promise<File[]>((resolve) => {
          reader.readEntries(async (entries: WebKitFileSystemEntry[]) => {
            if (entries.length === 0) {
              resolve(files);
              return;
            }

            const entryPromises = entries.map(async (childEntry) => {
              const childFiles = await processDirectoryEntry(
                childEntry,
                `${folderPath}${entry.name}/`
              );
              files.push(...childFiles);
            });

            await Promise.all(entryPromises);

            // Recursively call readEntries in case there are more entries
            const moreFiles = await readEntries();
            resolve([...files, ...moreFiles]);
          });
        });
      };

      return readEntries();
    }

    return files;
  }, []);

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Handle drop event
  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) {
      return; // Don't process new drops while uploading
    }

    const items = Array.from(e.dataTransfer.items);
    const detectedItems: DraggedItem[] = [];

    // Check if any of the items are folders
    let hasFolder = false;
    let folderName = '';
    const folderFiles: File[] = [];

    for (const item of items) {
      // Use webkitGetAsEntry to detect directories
      const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();

      if (!entry) {
        continue;
      }

      if (entry.isDirectory) {
        hasFolder = true;
        folderName = entry.name;
        // Type assertion since TypeScript doesn't recognize this API fully
        const files = await processDirectoryEntry(entry as unknown as WebKitFileSystemEntry, `${folderName}/`);
        folderFiles.push(...files);

        // Add each file to the visual list for UI feedback
        files.forEach(file => {
          detectedItems.push({ file, isFolder: true });
        });
      } else if (entry.isFile) {
        // It's a file, handle it directly
        await new Promise<void>(resolve => {
          (entry as unknown as WebKitFileSystemEntry).file((file: File) => {
            detectedItems.push({ file, isFolder: false });
            resolve();
          });
        });
      } else if (item.kind === 'file') {
        // Fallback for browsers that don't support webkitGetAsEntry
        const file = item.getAsFile();
        if (file) {
          detectedItems.push({ file, isFolder: false });
        }
      }
    }

    setDraggedItems(detectedItems);

    if (detectedItems.length === 0) {
      return;
    }

    // Check what was dropped and upload accordingly
    // Pass encryption setting to upload functions
    if (hasFolder && folderFiles.length > 0) {
      onUploadFolder(folderFiles, folderName, { encryption: enableEncryption });
      onClose(); // Close the modal after starting upload
    } else if (detectedItems.length === 1 && !detectedItems[0].isFolder) {
      onUploadFile(detectedItems[0].file, { encryption: enableEncryption });
      onClose(); // Close the modal after starting upload
    } else if (detectedItems.length > 0) {
      // Multiple files, treat as a folder upload
      const timestamp = Date.now();
      const autoFolderName = `Upload-${timestamp}`;
      onUploadFolder(
        detectedItems.map(item => item.file),
        autoFolderName,
        { encryption: enableEncryption }
      );
      onClose(); // Close the modal after starting upload
    }
  }, [onUploadFile, onUploadFolder, onClose, isUploading, processDirectoryEntry, enableEncryption]);

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onUploadFile(file, { encryption: enableEncryption });
      onClose(); // Close modal after selecting file
    }
  };

  // Handle folder input change
  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);

      // Try to determine folder name from the path of the first file
      let folderName = 'Folder';
      if (files[0].webkitRelativePath) {
        const pathParts = files[0].webkitRelativePath.split('/');
        if (pathParts.length > 1) {
          folderName = pathParts[0];
        }
      }

      onUploadFolder(files, folderName, { encryption: enableEncryption });
      onClose(); // Close modal after selecting folder
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div
        ref={modalRef}
        className={styles.modal}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            <FiUpload className={styles.modalIcon} />
            Upload to Blockchain Drive
          </h2>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
            disabled={isUploading}
          >
            <FiX />
          </button>
        </div>

        <div className={styles.modalContent}>
          <div
            className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={styles.dropZoneContent}>
              <div className={styles.dropIcon}>
                <FiArrowUp />
              </div>
              <h3 className={styles.dropTitle}>
                Drag & Drop
              </h3>
              <p className={styles.dropText}>
                Drop files or folders here to upload
              </p>

              <div className={styles.uploadOptions}>
                <div className={styles.uploadInfoItem}>
                  <span className={styles.uploadInfoLabel}>Network:</span>
                  <span className={styles.uploadInfoValue}>{uploadOptions.network}</span>
                </div>
                <div className={styles.uploadInfoItem}>
                  <span className={styles.uploadInfoLabel}>Compression:</span>
                  <span className={styles.uploadInfoValue}>{uploadOptions.compression ? 'Enabled' : 'Disabled'}</span>
                </div>

                {/* New encryption toggle */}
                <div className={styles.encryptionToggle}>
                  <label className={styles.encryptionLabel}>
                    <input
                      type="checkbox"
                      checked={enableEncryption}
                      onChange={handleToggleEncryption}
                      className={styles.encryptionCheckbox}
                    />
                    <span className={styles.encryptionIcon}>
                      {enableEncryption ? <FiLock /> : <FiUnlock />}
                    </span>
                    <span className={styles.encryptionText}>
                      {enableEncryption ? 'Encryption Enabled' : 'Encryption Disabled'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {draggedItems.length > 0 && (
            <div className={styles.draggedItems}>
              <h4 className={styles.draggedItemsTitle}>
                {draggedItems.length} item(s) ready to upload
              </h4>
              <div className={styles.draggedItemsList}>
                {draggedItems.slice(0, 5).map((item, index) => (
                  <div key={index} className={styles.draggedItem}>
                    {item.isFolder ? <FiFolder /> : <FiFile />}
                    <span className={styles.draggedItemName}>
                      {item.file.name}
                    </span>
                    <span className={styles.draggedItemSize}>
                      {(item.file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ))}
                {draggedItems.length > 5 && (
                  <div className={styles.moreItems}>
                    + {draggedItems.length - 5} more items
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <div className={styles.uploadButtons}>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={pageStyles.buttonPrimary}
              disabled={isUploading}
            >
              <FiFile className={pageStyles.buttonIconLeft} />
              Browse for File
            </button>

            <button
              onClick={() => folderInputRef.current?.click()}
              className={pageStyles.buttonSecondary}
              disabled={isUploading}
            >
              <FiFolder className={pageStyles.buttonIconLeft} />
              Upload Folder
            </button>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={isUploading}
            />

            {/* Use type assertion for non-standard attributes */}
            <input
              ref={folderInputRef}
              type="file"
              multiple
              onChange={handleFolderChange}
              style={{ display: 'none' }}
              disabled={isUploading}
              {...{ webkitdirectory: "", directory: "" } as ExtendedInputProps}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
