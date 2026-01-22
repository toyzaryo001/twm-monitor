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

// Run migrations
console.log("[railway-start] Running database migrations...");
const migrateResult = run("npx prisma migrate deploy");

if (!migrateResult) {
    console.log("[railway-start] Migration failed, trying db push...");
    run("npx prisma db push --accept-data-loss");
}

// Start the application
console.log("[railway-start] Starting application...");
run("npm run start");
