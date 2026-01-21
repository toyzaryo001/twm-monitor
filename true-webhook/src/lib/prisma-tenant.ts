// Tenant Prisma Client with dynamic schema switching
import { PrismaClient } from '../generated/prisma-tenant';

// Cache of tenant Prisma clients by schema name
const tenantClients = new Map<string, PrismaClient>();

function getDatabaseUrl(): string {
    const url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error('DATABASE_URL_NOT_SET');
    }
    return url;
}

/**
 * Get a Prisma client for a specific tenant schema
 * @param schemaName - The PostgreSQL schema name (e.g., "tenant_abc")
 */
export function getTenantPrisma(schemaName: string): PrismaClient {
    // Check cache
    const cached = tenantClients.get(schemaName);
    if (cached) return cached;

    // Build URL with schema
    const baseUrl = getDatabaseUrl();
    const url = new URL(baseUrl);
    url.searchParams.set('schema', schemaName);

    const client = new PrismaClient({
        datasources: {
            db: {
                url: url.toString(),
            },
        },
    });

    tenantClients.set(schemaName, client);
    return client;
}

/**
 * Create a new schema for a tenant and apply migrations
 */
export async function provisionTenantSchema(schemaName: string): Promise<void> {
    const baseUrl = getDatabaseUrl();

    // Use raw SQL to create schema
    const { PrismaClient: RawClient } = await import('../generated/prisma-tenant');
    const rawClient = new RawClient();

    try {
        // Create schema if not exists
        await rawClient.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

        // Create tables in the new schema
        // Note: In production, you'd run prisma migrate deploy with the schema
        // For now, we'll create tables manually using raw SQL

        await rawClient.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."Account" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "trueWalletEndpointUrl" TEXT NOT NULL,
        "trueWalletBearerToken" TEXT NOT NULL,
        "mobileNo" TEXT,
        "autoRefreshEnabled" BOOLEAN NOT NULL DEFAULT true,
        "autoRefreshIntervalSeconds" INTEGER NOT NULL DEFAULT 60,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

        await rawClient.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."TelegramConfig" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "accountId" TEXT NOT NULL UNIQUE,
        "botToken" TEXT NOT NULL,
        "chatId" TEXT NOT NULL,
        "enabled" BOOLEAN NOT NULL DEFAULT true,
        "notifyMoneyIn" BOOLEAN NOT NULL DEFAULT true,
        "notifyMoneyOut" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TelegramConfig_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "${schemaName}"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

        await rawClient.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "${schemaName}"."NotificationType" AS ENUM ('balance_change', 'telegram_sent', 'telegram_failed', 'system');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

        await rawClient.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."BalanceSnapshot" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "accountId" TEXT NOT NULL,
        "balanceSatang" INTEGER NOT NULL,
        "mobileNo" TEXT,
        "source" TEXT,
        "walletUpdatedAt" TIMESTAMP(3),
        "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "BalanceSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "${schemaName}"."Account"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

        await rawClient.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "BalanceSnapshot_accountId_checkedAt_idx" ON "${schemaName}"."BalanceSnapshot"("accountId", "checkedAt")
    `);

        await rawClient.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."NotificationLog" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "type" "${schemaName}"."NotificationType" NOT NULL,
        "message" TEXT NOT NULL,
        "payload" JSONB,
        "accountId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "NotificationLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "${schemaName}"."Account"("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);

        await rawClient.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "NotificationLog_accountId_createdAt_idx" ON "${schemaName}"."NotificationLog"("accountId", "createdAt")
    `);

    } finally {
        await rawClient.$disconnect();
    }
}

/**
 * Delete a tenant schema (use with caution!)
 */
export async function deleteTenantSchema(schemaName: string): Promise<void> {
    const { PrismaClient: RawClient } = await import('../generated/prisma-tenant');
    const rawClient = new RawClient();

    try {
        await rawClient.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        tenantClients.delete(schemaName);
    } finally {
        await rawClient.$disconnect();
    }
}

export type { PrismaClient as TenantPrismaClient };
