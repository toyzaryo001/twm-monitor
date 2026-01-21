// Master Prisma Client
import { PrismaClient } from '../generated/prisma-master';

declare global {
    // eslint-disable-next-line no-var
    var __masterPrisma: PrismaClient | undefined;
}

let masterPrisma: PrismaClient | undefined;

export function getMasterPrisma(): PrismaClient {
    if (masterPrisma) return masterPrisma;

    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL_NOT_SET');
    }

    const client = new PrismaClient();

    if (process.env.NODE_ENV !== 'production') {
        masterPrisma = global.__masterPrisma ?? client;
        global.__masterPrisma = masterPrisma;
        return masterPrisma;
    }

    masterPrisma = client;
    return masterPrisma;
}

export type { PrismaClient as MasterPrismaClient };
