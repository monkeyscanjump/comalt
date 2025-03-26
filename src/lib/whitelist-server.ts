/**
 * Server-side whitelist utilities
 * These functions should only be used in server components or API routes
 */

// Get allowed addresses from environment
export function getAllowedAddresses(): string[] {
  const allowedWallets = process.env.ALLOWED_WALLETS || '';
  return allowedWallets.split(',').map(addr => addr.trim()).filter(Boolean);
}

// Check if public mode (no whitelist)
export function isPublicMode(): boolean {
  return getAllowedAddresses().length === 0;
}

// Check if an address is allowed
export function isAddressAllowed(address: string): boolean {
  if (!address) return false;

  // Use the existing isPublicMode function instead of recalculating
  const publicMode = isPublicMode();

  // Either we're in public mode or the address is explicitly allowed
  return publicMode || getAllowedAddresses().includes(address);
}

// Check if an address is an admin
export function isAddressAdmin(address: string): boolean {
  if (!address) return false;

  // In public mode, everyone is an admin
  if (isPublicMode()) return true;

  const allowedAddresses = getAllowedAddresses();

  // The first address in the list is the admin
  return allowedAddresses[0] === address;
}
