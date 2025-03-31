// Format file size
export const formatFileSize = (bytes: number | string): string => {
  if (bytes === 0 || bytes === '0') return '0 B';
  if (!bytes) return 'Unknown';

  // Convert string to number if needed
  const numBytes = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;

  if (isNaN(numBytes)) return 'Unknown';
  if (numBytes < 1024) return `${numBytes} B`;
  if (numBytes < 1024 * 1024) return `${(numBytes / 1024).toFixed(1)} KB`;
  if (numBytes < 1024 * 1024 * 1024) return `${(numBytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(numBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

// Format date
export const formatDate = (dateString?: string): string => {
  if (!dateString) return 'Unknown date';
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return 'Unknown date';
  }
};
