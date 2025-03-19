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

  const allowedAddresses = getAllowedAddresses();
  const publicMode = allowedAddresses.length === 0;

  // Either we're in public mode or the address is explicitly allowed
  return publicMode || allowedAddresses.includes(address);
}
