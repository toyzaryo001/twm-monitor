import { spawnSync } from "node:child_process";

function runPrisma(args) {
    const prismaBin = process.platform === "win32" ? "prisma.cmd" : "prisma";
    return spawnSync(prismaBin, args, {
        stdio: "inherit",
        env: process.env,
    });
}

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
    process.env.DATABASE_URL = databaseUrl;

    const resetDb = process.env.RESET_DB === "true" || process.env.RESET_DB === "1";

    if (resetDb) {
        console.log("[railway-start] RESET_DB=true - Pushing schema...");
        const result = runPrisma(["db", "push", "--force-reset", "--config=prisma/prisma.config.ts"]);
        if (result.status !== 0) {
            console.error("[railway-start] db push failed!");
        } else {
            console.log("[railway-start] Database reset complete.");
        }
    } else {
        console.log("[railway-start] Running migrations...");
        const result = runPrisma(["migrate", "deploy", "--config=prisma/prisma.config.ts"]);
        if (result.status !== 0) {
            console.warn("[railway-start] Migration failed, trying db push...");
            runPrisma(["db", "push", "--config=prisma/prisma.config.ts"]);
        }
    }
} else {
    console.warn("[railway-start] No DATABASE_URL found. Skipping migrations.");
}

process.env.NODE_ENV = "production";

console.log("[railway-start] Starting server...");

const server = spawnSync("node", ["dist/server.js"], {
    stdio: "inherit",
    env: process.env,
});

process.exit(server.status ?? 0);
