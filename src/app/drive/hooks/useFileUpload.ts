import { useState, useCallback, useRef, useEffect } from 'react';
import { UploadOptions, NetworkType } from '../types';

// Define proper type for upload progress
export interface UploadProgressType {
  current: number;
  total: number;
  message: string;
}

// Define options for upload
export interface UploadFileOptions {
  encryption?: boolean;
}

interface UseFileUploadProps {
  isAuthenticated: boolean;
  network: NetworkType;
  refreshFiles: () => Promise<void> | void;
}

export function useFileUpload({ isAuthenticated, network, refreshFiles }: UseFileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressType>({
    current: 0,
    total: 0,
    message: ''
  });
  const [uploadOptions, setUploadOptions] = useState<Omit<UploadOptions, 'network'>>({
    compression: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [showUploadOptions, setShowUploadOptions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset the upload progress when upload starts/finishes
  useEffect(() => {
    if (!isUploading) {
      // Reset progress after a delay to allow animation to complete
      const timer = setTimeout(() => {
        setUploadProgress({ current: 0, total: 0, message: '' });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isUploading]);

  // Toggle upload options panel
  const toggleUploadOptions = useCallback(() => {
    setShowUploadOptions(prev => !prev);
  }, []);

  // Handle compression toggle
  const toggleCompression = useCallback(() => {
    setUploadOptions(prev => ({
      ...prev,
      compression: !prev.compression
    }));
  }, []);

  // Handle file upload with options
  const handleUpload = useCallback(async (file: File, options?: UploadFileOptions) => {
    if (!isAuthenticated) return;

    try {
      setIsUploading(true);
      setUploadProgress({
        current: 0,
        total: 100,
        message: `Uploading ${file.name}...`
      });
      setError(null);

      console.log(`Uploading file: ${file.name} (${file.size} bytes) to network: ${network}`);

      // Create form data for file upload
      const formData = new FormData();
      formData.append('file', file);

      // Add compression option to the form data
      formData.append('compression', uploadOptions.compression.toString());

      // Add encryption setting (default to true if not specified)
      const enableEncryption = options?.encryption !== false;
      formData.append('encryption', enableEncryption.toString());

      console.log(`Upload options: compression=${uploadOptions.compression}, encryption=${enableEncryption}`);

      // Use Fetch API with progress monitoring
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress({
            current: progress,
            total: 100,
            message: `Uploading ${file.name}... ${progress}%`
          });
        }
      });

      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          console.log('File uploaded successfully:', response);

          setUploadProgress({
            current: 100,
            total: 100,
            message: `${file.name} uploaded successfully!`
          });

          // Refresh file list to show the new file
          if (refreshFiles) {
            await refreshFiles();
          }
        } else {
          let errorMsg = 'Failed to upload file';
          try {
            const errorData = JSON.parse(xhr.responseText);
            errorMsg = errorData.error || errorMsg;
          } catch (e) {
            // Ignore parsing error
          }
          throw new Error(errorMsg);
        }

        setTimeout(() => {
          setIsUploading(false);
        }, 2000);
      });

      xhr.addEventListener('error', () => {
        setError('Network error during file upload');
        setIsUploading(false);
      });

      xhr.addEventListener('abort', () => {
        setError('File upload cancelled');
        setIsUploading(false);
      });

      xhr.open('POST', `/api/drive/files?network=${network}`);
      xhr.send(formData);

    } catch (err) {
      console.error('Upload failed:', err);
      setError(`Failed to upload file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsUploading(false);
    }
  }, [isAuthenticated, network, uploadOptions, refreshFiles]);

  // Properly typed and implemented folder upload function
  const handleUploadFolder = useCallback(async (files: File[], folderName: string, options?: UploadFileOptions) => {
    if (!isAuthenticated || files.length === 0) return;

    try {
      setIsUploading(true);
      setError(null);
      setUploadProgress({
        current: 0,
        total: files.length,
        message: `Preparing folder "${folderName}" for upload...`
      });

      // Add encryption setting (default to true if not specified)
      const enableEncryption = options?.encryption !== false;

      console.log(`Uploading folder: ${folderName} with ${files.length} files to network: ${network}`);
      console.log(`Upload options: compression=${uploadOptions.compression}, encryption=${enableEncryption}`);

      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      formData.append('folderName', folderName);
      formData.append('compression', uploadOptions.compression.toString());
      formData.append('encryption', enableEncryption.toString());

      // Set up progress updates for folder upload
      let count = 0;
      const interval = setInterval(() => {
        count++;
        // We don't know exact progress, so simulate it
        const simulatedProgress = Math.min(
          files.length - 1,
          Math.floor(count * files.length / 10)
        );
        setUploadProgress({
          current: simulatedProgress,
          total: files.length,
          message: `Uploading folder "${folderName}"... (${simulatedProgress}/${files.length} files)`
        });
      }, 1000);

      const response = await fetch(`/api/drive/folders?network=${network}`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(interval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload folder');
      }

      await response.json();

      setUploadProgress({
        current: files.length,
        total: files.length,
        message: `Folder "${folderName}" uploaded successfully!`
      });

      // Refresh file list
      if (refreshFiles) {
        await refreshFiles();
      }

    } catch (error) {
      console.error('Folder upload error:', error);
      setError(`Failed to upload folder: ${error instanceof Error ? error.message : String(error)}`);
      setUploadProgress({
        current: 0,
        total: 1,
        message: 'Error uploading folder'
      });
    } finally {
      // Keep progress visible for a moment
      setTimeout(() => {
        setIsUploading(false);
      }, 2000);
    }
  }, [isAuthenticated, network, uploadOptions, refreshFiles]);

  return {
    isUploading,
    uploadProgress,
    uploadOptions,
    error,
    setError,
    showUploadOptions,
    fileInputRef,
    toggleUploadOptions,
    toggleCompression,
    handleUpload,
    handleUploadFolder
  };
}
