import React from 'react';
import { LoadingState } from '@/components/LoadingState';
import {
  FiFolder,
  FiCalendar,
  FiFileText,
  FiEye,
  FiShare2,
  FiTrash2,
  FiLock,
  FiUnlock
} from 'react-icons/fi';
import pageStyles from '@/styles/pages.module.css';
import styles from '../drive.module.css';
import { DriveFile, NetworkType } from '../types';

interface FileListProps {
  files: DriveFile[];
  isLoading: boolean;
  hasMore: boolean;
  fileMetadata: Record<string, any>;
  loadingMetadata: Record<string, boolean>;
  onLoadMore: () => void;
  onViewFile: (file: DriveFile) => void;
  onShareFile: (cid: string) => void;
  onDeleteFile: (cid: string) => void;
  formatFileSize: (bytes: number) => string;
  network: NetworkType;
}

export const FileList: React.FC<FileListProps> = ({
  files,
  isLoading,
  hasMore,
  fileMetadata,
  loadingMetadata,
  onLoadMore,
  onViewFile,
  onShareFile,
  onDeleteFile,
  formatFileSize,
  network
}) => {
  return (
    <div className={styles.fileListContainer}>
      {files.length > 0 ? (
        <>
          <div className={`${pageStyles.table} ${styles.fileTable}`}>
            <div className={`${pageStyles.tableHeader} ${styles.fileTableHeader}`}>
              <div>Name</div>
              <div>Size</div>
              <div>Type</div>
              <div>Status</div>
              <div>Actions</div>
            </div>

            {files.map(file => (
              <div
                key={file.headCid}
                className={`${pageStyles.tableRow} ${styles.fileTableRow}`}
              >
                <div className={styles.fileName}>
                  {file.type === 'folder' && <FiFolder className={styles.folderIcon} />}
                  {file.name}
                </div>
                <div>{formatFileSize(file.size)}</div>
                <div>{file.type || 'Unknown'}</div>
                <div className={styles.statusCell}>

                  {file.createdAt && (
                    <span className={styles.metadataBadge} title={`Created: ${new Date(file.createdAt).toLocaleDateString()}`}>
                      <FiCalendar />
                    </span>
                  )}
                </div>
                <div className={styles.rowActions}>
                  {/* Replace text buttons with icon buttons */}
                  <button
                    className={pageStyles.buttonIconOnly}
                    onClick={() => onViewFile(file)}
                    title="View file"
                    aria-label="View file"
                  >
                    <FiEye />
                  </button>
                  <button
                    className={pageStyles.buttonIconOnly}
                    onClick={() => onShareFile(file.headCid)}
                    title="Create shareable link"
                    aria-label="Share file"
                  >
                    <FiShare2 />
                  </button>
                  <button
                    className={`${pageStyles.buttonIconOnly} ${pageStyles.buttonDanger}`}
                    onClick={() => onDeleteFile(file.headCid)}
                    title="Delete file"
                    aria-label="Delete file"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Load more button */}
          {hasMore && !isLoading && (
            <div className={styles.loadMoreContainer}>
              <button
                onClick={onLoadMore}
                className={pageStyles.buttonSecondary}
              >
                Load More
              </button>
            </div>
          )}

          {/* Loading indicator for pagination */}
          {isLoading && files.length > 0 && (
            <div className={styles.loadingMore}>
              <LoadingState message="Loading more files..." />
            </div>
          )}
        </>
      ) : (
        <div className={pageStyles.noResults}>
          <p>No files found on {network === 'mainnet' ? 'Mainnet' : 'Testnet'}. Upload your first file to get started.</p>
        </div>
      )}
    </div>
  );
}
