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

// Run db push
console.log("[railway-start] Syncing database schema...");
run("npx prisma db push --accept-data-loss");

// Run seed script
console.log("[railway-start] Seeding admin user...");
run("node scripts/seed.js");

// Start the application
console.log("[railway-start] Starting application...");
run("node dist/server.js");
