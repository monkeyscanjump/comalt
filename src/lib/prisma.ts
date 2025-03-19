import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.

// Properly declare the global prisma instance
declare global {
  // Use var instead of let for global augmentation
  var prisma: PrismaClient | undefined;
}

// Only instantiate PrismaClient if we're on the server
const prisma =
  typeof window === 'undefined'
    ? globalThis.prisma || new PrismaClient()
    : undefined as unknown as PrismaClient;

if (process.env.NODE_ENV !== 'production' && typeof window === 'undefined') {
  globalThis.prisma = prisma;
}

// Export a dummy client for the client-side that will throw a clear error
const clientSafePrisma = new Proxy({} as PrismaClient, {
  get: () => {
    throw new Error('PrismaClient cannot be used in the browser');
  }
});

export default typeof window === 'undefined' ? prisma : clientSafePrisma;
