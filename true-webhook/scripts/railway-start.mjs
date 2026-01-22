#!/usr/bin/env node
import { execSync } from "child_process";
import crypto from "crypto";

// Updated: 2026-01-22 10:50
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

// Seed default admin using Prisma with CORRECT scrypt hash
console.log("[railway-start] Checking for admin user...");

const seedScript = `
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

// Use scryptSync like lib/auth.ts
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return salt + ":" + hash;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    // Delete existing admin to recreate with correct hash
    await prisma.user.deleteMany({ where: { email: "superTT" } });
    
    await prisma.user.create({
      data: {
        email: "superTT",
        passwordHash: hashPassword("Tt112233"),
        displayName: "Super Admin",
        role: "MASTER"
      }
    });
    console.log("[seed] Created admin: superTT / Tt112233");
  } catch (e) {
    console.error("[seed] Error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
`;

try {
    execSync(`node -e '${seedScript.replace(/'/g, "\\'").replace(/\n/g, " ")}'`, { stdio: "inherit" });
} catch (e) {
    console.error("[railway-start] Seed failed:", e.message);
}

// Start the application  
console.log("[railway-start] Starting application...");
run("node dist/server.js");
