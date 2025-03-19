import { IconType } from 'react-icons';

export interface PageMetadata {
  title: string;
  icon?: IconType;
  path: string;
  order?: number; // For sorting in navigation
  showInNav?: boolean; // Whether to show in navigation
}

export type PagesRegistry = Record<string, PageMetadata>;
