#!/usr/bin/env node
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

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

// Hash password function
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    return `${salt}:${hash}`;
}

async function seedDefaultAdmin() {
    const prisma = new PrismaClient();

    try {
        // Check if any MASTER user exists
        const existingMaster = await prisma.user.findFirst({
            where: { role: "MASTER" }
        });

        if (!existingMaster) {
            console.log("[railway-start] Creating default admin user...");

            // Create default admin
            await prisma.user.create({
                data: {
                    email: "superTT",
                    passwordHash: hashPassword("Tt112233"),
                    displayName: "Super Admin",
                    role: "MASTER"
                }
            });

            console.log("[railway-start] Default admin created: superTT / Tt112233");
        } else {
            console.log("[railway-start] Admin user already exists, skipping seed");
        }
    } catch (error) {
        console.error("[railway-start] Failed to seed admin:", error.message);
    } finally {
        await prisma.$disconnect();
    }
}

// Run migrations
console.log("[railway-start] Running database migrations...");
const migrateResult = run("npx prisma migrate deploy");

if (!migrateResult) {
    console.log("[railway-start] Migration failed, trying db push...");
    run("npx prisma db push --accept-data-loss");
}

// Seed default admin
await seedDefaultAdmin();

// Start the application
console.log("[railway-start] Starting application...");
run("node dist/server.js");
