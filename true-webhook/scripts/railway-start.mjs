#!/usr/bin/env node
import { execSync } from "child_process";

console.log("[railway-start] Starting deployment...");

function run(cmd) {
    console.log(`[railway-start] Running: ${cmd}`);
    try {
        execSync(cmd, { stdio: "inherit" });
        return true;
    } catch (error) {
        console.error(`[railway-start] Command failed: ${cmd}`);
        return false;
    }
}

if (process.env.SKIP_DB_SYNC === "true") {
    console.log("[railway-start] Skipping database schema sync (SKIP_DB_SYNC=true)");
} else {
    console.log("[railway-start] Syncing database schema...");
    run("npx prisma db push --accept-data-loss");
}

if (process.env.SKIP_SEED === "true") {
    console.log("[railway-start] Skipping seed (SKIP_SEED=true)");
} else {
    console.log("[railway-start] Seeding admin user...");
    run("node scripts/seed.js");
}

// Start the application
console.log("[railway-start] Starting application...");
run("node dist/server.js");
