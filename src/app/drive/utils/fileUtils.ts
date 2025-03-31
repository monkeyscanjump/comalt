import { NetworkType } from '../types';

// File info detection with special handling for dot files
export interface FileInfo {
  fileExtension: string;
  isConfigFile: boolean;
  displayExtension: string;
  viewerType: string;
}

export const getFileInfo = (name: string, type: string, isFolder: boolean): FileInfo => {
  // Check if it's a dot file (starts with a dot)
  const isDotFile = name.startsWith('.');

  // Get parts of the filename
  const parts = name.split('.');

  // Initialize file info
  let fileExtension = '';
  let isConfigFile = false;
  let displayExtension = '';

  // Determine if this is a hidden config file like .env or .gitignore
  if (isDotFile && parts.length <= 2) {
    // This is a dot file with no extension (like .env, .gitignore)
    isConfigFile = true;
    displayExtension = isDotFile ? name.substring(1).toUpperCase() : '';
  } else {
    // Normal file with extension
    fileExtension = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    displayExtension = fileExtension.toUpperCase();
  }

  // Determine viewer type
  const viewerType = getViewerType(fileExtension, type, isFolder, isConfigFile);

  return {
    fileExtension,
    isConfigFile,
    displayExtension,
    viewerType
  };
};

// Determine file type for preview
export const getViewerType = (
  fileExtension: string,
  mimeType: string,
  isFolder: boolean,
  isConfigFile: boolean
): string => {
  if (isFolder) return 'folder';

  // Special handling for config/dot files - treat them as text
  if (isConfigFile) return 'text';

  // Handle by MIME type
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('text/')) return 'text';

  // Handle by extension as fallback
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  const textExts = ['txt', 'md', 'csv', 'log', 'env', 'gitignore', 'npmrc', 'editorconfig'];
  const codeExts = ['json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx', 'php', 'py', 'java', 'c', 'cpp', 'h', 'rb'];
  const pdfExts = ['pdf'];

  if (imageExts.includes(fileExtension)) return 'image';
  if (pdfExts.includes(fileExtension)) return 'pdf';
  if (textExts.includes(fileExtension)) return 'text';
  if (codeExts.includes(fileExtension)) return 'code';

  return 'none';
};

// Generate a download URL for a file
export const getDownloadUrl = (fileCid: string, fileName: string, network: NetworkType): string => {
  return `/api/drive/files/${fileCid}/view?network=${network}&download=true&filename=${encodeURIComponent(fileName)}`;
};
