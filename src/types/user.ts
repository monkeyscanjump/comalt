export interface User {
  id: string;
  address: string;
  name: string | null;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  username?: string;
}
