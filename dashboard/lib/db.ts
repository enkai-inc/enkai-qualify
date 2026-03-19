import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Graceful shutdown: disconnect Prisma on process termination
if (typeof process !== 'undefined') {
  const shutdown = () => {
    prisma.$disconnect().catch(() => {});
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export default prisma;
