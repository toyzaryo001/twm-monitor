import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

function pickEnv(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

function buildPostgresUrlFromParts(): string | undefined {
  const host = pickEnv(['PGHOST', 'POSTGRES_HOST', 'POSTGRESQL_HOST']);
  const port = pickEnv(['PGPORT', 'POSTGRES_PORT', 'POSTGRESQL_PORT']) ?? '5432';
  const database = pickEnv([
    'PGDATABASE',
    'POSTGRES_DB',
    'POSTGRES_DATABASE',
    'POSTGRESQL_DATABASE',
  ]);
  const user = pickEnv(['PGUSER', 'POSTGRES_USER', 'POSTGRESQL_USER']);
  const password = pickEnv(['PGPASSWORD', 'POSTGRES_PASSWORD', 'POSTGRESQL_PASSWORD']);

  if (!host || !database || !user) return undefined;

  const auth = password
    ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
    : `${encodeURIComponent(user)}`;

  return `postgresql://${auth}@${host}:${port}/${database}`;
}

function getDatabaseUrl(): string | undefined {
  return (
    pickEnv([
      'DATABASE_URL',
      'DATABASE_PRIVATE_URL',
      'POSTGRES_URL',
      'POSTGRESQL_URL',
      'RAILWAY_DATABASE_URL',
    ]) ?? buildPostgresUrlFromParts()
  );
}

let prismaSingleton: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (prismaSingleton) return prismaSingleton;

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL_NOT_SET');
  }

  // Prisma Client expects the datasource URL from env in this project.
  process.env.DATABASE_URL = databaseUrl;

  const client = new PrismaClient();

  if (process.env.NODE_ENV !== 'production') {
    prismaSingleton = global.__prismaClient ?? client;
    global.__prismaClient = prismaSingleton;
    return prismaSingleton;
  }

  prismaSingleton = client;
  return prismaSingleton;
}
