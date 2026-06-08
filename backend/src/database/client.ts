import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = (): PrismaClient => {
  // Use DIRECT_URL for runtime queries — bypasses pgBouncer pooler entirely.
  // This avoids "cached plan must not change result type" which happens when
  // pgBouncer caches prepared statement plans that become invalid after migrations.
  const directUrl = process.env.DIRECT_URL;
  const databaseUrl = process.env.DATABASE_URL;

  // Build the connection URL — prefer direct, fall back to pooled
  let url = directUrl ?? databaseUrl ?? '';

  // Remove pgbouncer params from direct URL if accidentally included
  url = url
    .replace(/[&?]pgbouncer=true/gi, '')
    .replace(/[&?]channel_binding=require/gi, '')
    .replace(/\?$/, '');

  // Re-add sslmode if it was stripped
  if (!url.includes('sslmode')) {
    url += url.includes('?') ? '&sslmode=require' : '?sslmode=require';
  }

  logger.info({
    usingDirect: !!directUrl,
    urlPreview: url.replace(/:([^@]+)@/, ':***@'),
  }, 'Creating Prisma client');

  const client = new PrismaClient({
    log: [
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
    datasources: { db: { url } },
  });

  client.$on('error', (e) => {
    logger.error({ target: e.target, message: e.message }, 'Prisma error');
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
}
