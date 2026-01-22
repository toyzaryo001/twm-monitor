#!/usr/bin/env node
import { execSync } from "child_process";
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

// Hash password function (same as lib/auth.ts)
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    return `${salt}:${hash}`;
}

// Run db push
console.log("[railway-start] Syncing database schema...");
run("npx prisma db push --accept-data-loss");

// Seed default admin using Prisma
console.log("[railway-start] Checking for admin user...");

const seedScript = `
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return salt + ":" + hash;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findFirst({ where: { role: "MASTER" } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: "superTT",
          passwordHash: hashPassword("Tt112233"),
          displayName: "Super Admin",
          role: "MASTER"
        }
      });
      console.log("[seed] Created default admin: superTT");
    } else {
      console.log("[seed] Admin already exists:", existing.email);
    }
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
