import { useState, useCallback, useRef } from 'react';
import { DriveFile, NetworkType } from '../types';

interface UseFileManagementProps {
  isAuthenticated: boolean;
  network: NetworkType;
}

export function useFileManagement({ isAuthenticated, network }: UseFileManagementProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const LIMIT = 20; // Number of files to fetch per page

  // Reference to track if we're currently searching
  const isSearchingRef = useRef(false);

  // Fetch files from our backend API
  const fetchFiles = useCallback(async (pageNum = 0, searchValue?: string) => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      setError(null);

      // Track if we're searching to handle results differently
      isSearchingRef.current = !!searchValue;

      // Build the API URL with query parameters
      let url = `/api/drive/files?page=${pageNum}&limit=${LIMIT}&network=${network}`;
      if (searchValue) {
        url += `&query=${encodeURIComponent(searchValue)}`;
      }

      console.log(`Fetching files from: ${url}`);
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch files');
      }

      const data = await response.json();

      // Process the files data
      const fileList = (data.files || []).map((file: any) => ({
        id: file.id || file.headCid || `id-${Math.random()}`,
        headCid: file.headCid || '',
        name: file.name || 'Unnamed File',
        size: file.size || 0,
        type: file.type || 'Unknown',
        // Construct URL for viewing files with network parameter
        url: `/api/drive/files/${file.headCid}/view?network=${network}`,
        createdAt: file.createdAt || new Date().toISOString(),
        updatedAt: file.updatedAt || new Date().toISOString(),
        isPublic: file.isPublic || false,
        publicUrl: file.publicUrl || null
      }));

      // Update the total count for pagination
      if (data.totalCount !== undefined) {
        setTotalCount(data.totalCount);
        setHasMore(fileList.length === LIMIT && data.totalCount > (pageNum + 1) * LIMIT);
      } else if (searchValue) {
        // When searching, we might not get totalCount
        setHasMore(false);
      }

      // Always replace all files when searching (regardless of pageNum)
      // or when we're at page 0 (initial load or refresh)
      if (searchValue || pageNum === 0) {
        setFiles(fileList);
      } else {
        // Only append files when loading more pages during normal browsing
        setFiles(prevFiles => [...prevFiles, ...fileList]);
      }

      setPage(pageNum);
    } catch (err) {
      console.error('Failed to fetch files:', err);
      setError(`Failed to load files: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [LIMIT, isAuthenticated, network]);

  // Handle file delete
  const handleDelete = useCallback(async (cid: string) => {
    if (!isAuthenticated) return;

    try {
      console.log(`Deleting file with CID: ${cid} on network: ${network}`);

      // Change the endpoint to match our actual route implementation
      // FROM: /api/drive/files/${cid}?network=${network}
      // TO:   /api/drive/files/${cid}/delete?network=${network}
      const response = await fetch(`/api/drive/files/${cid}/delete?network=${network}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete file');
      }

      console.log('File deleted successfully');

      // Remove the file from the UI immediately
      setFiles(prevFiles => prevFiles.filter(file => file.headCid !== cid));
    } catch (err) {
      console.error('Delete failed:', err);
      setError(`Failed to delete file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [isAuthenticated, network]);

  // Handle search query change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    // If search box is cleared, refresh with all files
    if (!value.trim()) {
      fetchFiles(0);
      return;
    }

    // Debounce search to avoid too many requests
    const timer = setTimeout(() => {
      fetchFiles(0, value);
    }, 300);

    return () => clearTimeout(timer);
  }, [fetchFiles]);

  // Load more files
  const loadMoreFiles = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchFiles(page + 1, searchQuery);
    }
  }, [isLoading, hasMore, page, fetchFiles, searchQuery]);

  return {
    files,
    setFiles,
    isLoading,
    error,
    setError,
    hasMore,
    totalCount,
    searchQuery,
    fetchFiles,
    handleDelete,
    handleSearchChange,
    loadMoreFiles
  };
}
