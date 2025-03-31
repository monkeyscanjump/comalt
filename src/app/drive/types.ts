export interface DriveFile {
  id: string;
  headCid: string;
  name: string;
  size: number;
  type: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  isPublic?: boolean;
  publicUrl?: string;
  // Metadata properties that may be added
  extension?: string;
  isFolder?: boolean;
  fileCount?: number;
  mimeType?: string;
}

export interface UploadOptions {
  compression: boolean;
  network: 'mainnet' | 'testnet';
}

export type NetworkType = 'mainnet' | 'testnet';
