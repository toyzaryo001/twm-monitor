import "dotenv/config";
import { defineConfig } from "prisma/config";

function pickEnv(keys: string[]): string | undefined {
    for (const key of keys) {
        const value = process.env[key];
        if (value && value.trim()) return value.trim();
    }
    return undefined;
}

const databaseUrl = pickEnv([
    "DATABASE_URL",
    "DATABASE_PRIVATE_URL",
    "POSTGRES_URL",
    "POSTGRESQL_URL",
    "RAILWAY_DATABASE_URL",
]);

export default defineConfig({
    schema: "./schema.prisma",
    datasource: {
        url: databaseUrl,
    },
});
