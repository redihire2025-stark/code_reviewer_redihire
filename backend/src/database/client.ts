import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

// Singleton pattern: reuse the same PrismaClient across the app.
// In development, store it on the global object to prevent hot-reload
// from creating multiple connections.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = (): PrismaClient => {
  const client = new PrismaClient({
    log: [
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  client.$on('error', (e) => {
    logger.error({ msg: 'Prisma error', target: e.target, message: e.message });
  });

  client.$on('warn', (e) => {
    logger.warn({ msg: 'Prisma warning', target: e.target, message: e.message });
  });

  return client;
};

export const prisma: PrismaClient =
  globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
