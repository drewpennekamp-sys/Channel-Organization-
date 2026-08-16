import { PrismaClient } from '@prisma/client';

// Standard Next.js dev-mode singleton: hot reload re-evaluates this module
// on every edit, and without caching the instance on `globalThis` each
// reload would open a fresh SQLite connection and eventually exhaust the
// connection/file-handle limit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
