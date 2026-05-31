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

if (process.env.RUN_MIGRATIONS_ON_START === "true") {
    console.log("[railway-start] Running Prisma migrations (RUN_MIGRATIONS_ON_START=true)...");
    run("npx prisma migrate deploy");
} else {
    console.log("[railway-start] Skipping database migrations by default");
}

if (process.env.RUN_SEED_ON_START === "true") {
    console.log("[railway-start] Seeding admin user...");
    run("node scripts/seed.js");
} else {
    console.log("[railway-start] Skipping seed by default");
}

// Start the application
console.log("[railway-start] Starting application...");
run("node dist/server.js");
