import { spawnSync } from "node:child_process";

function pickEnv(keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

function buildPostgresUrlFromParts() {
  const host = pickEnv(["PGHOST", "POSTGRES_HOST", "POSTGRESQL_HOST"]);
  const port = pickEnv(["PGPORT", "POSTGRES_PORT", "POSTGRESQL_PORT"]) || "5432";
  const database = pickEnv(["PGDATABASE", "POSTGRES_DB", "POSTGRES_DATABASE", "POSTGRESQL_DATABASE"]);
  const user = pickEnv(["PGUSER", "POSTGRES_USER", "POSTGRESQL_USER"]);
  const password = pickEnv(["PGPASSWORD", "POSTGRES_PASSWORD", "POSTGRESQL_PASSWORD"]);

  if (!host || !database || !user) return undefined;

  const auth = password
    ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
    : `${encodeURIComponent(user)}`;

  return `postgresql://${auth}@${host}:${port}/${database}`;
}

function runPrisma(args) {
  const prismaBin = process.platform === "win32" ? "prisma.cmd" : "prisma";
  return spawnSync(prismaBin, args, {
    stdio: "inherit",
    env: process.env,
  });
}

function runPrismaCapture(args) {
  const prismaBin = process.platform === "win32" ? "prisma.cmd" : "prisma";
  return spawnSync(prismaBin, args, {
    encoding: "utf-8",
    env: process.env,
  });
}

const databaseUrl =
  pickEnv([
    "DATABASE_URL",
    "DATABASE_PRIVATE_URL",
    "POSTGRES_URL",
    "POSTGRESQL_URL",
    "RAILWAY_DATABASE_URL",
  ]) || buildPostgresUrlFromParts();

if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;

  // Check if RESET_DB is set - this will reset the database completely
  const resetDb = process.env.RESET_DB === "true" || process.env.RESET_DB === "1";

  if (resetDb) {
    console.log("[railway-start] RESET_DB=true - Resetting database...");
    const resetResult = runPrisma(["migrate", "reset", "--force", "--skip-seed", "--config=prisma/master/prisma.config.ts"]);
    if (resetResult.status !== 0) {
      console.error("[railway-start] Database reset failed!");
      process.exit(resetResult.status ?? 1);
    }
    console.log("[railway-start] Database reset complete.");
  } else {
    console.log("[railway-start] DATABASE_URL detected; running Master migrations...");

    // First attempt to run Master schema migrations
    let result = runPrisma(["migrate", "deploy", "--config=prisma/master/prisma.config.ts"]);

    // If migration failed (possibly P3009 - failed migrations exist)
    if (result.status !== 0) {
      console.log("[railway-start] Migration failed. Attempting to resolve failed migrations...");

      // Try to resolve failed migration as rolled-back
      const resolveResult = runPrisma(["migrate", "resolve", "--rolled-back", "20260122130000_init_master", "--config=prisma/master/prisma.config.ts"]);

      if (resolveResult.status === 0) {
        console.log("[railway-start] Resolved failed migration. Retrying deploy...");

        // Retry the migration
        result = runPrisma(["migrate", "deploy"]);

        if (result.status !== 0) {
          console.error("[railway-start] Migration still failed after resolve. Please check your database.");
          // Don't exit - try to start server anyway if DB might be partially set up
        }
      } else {
        console.warn("[railway-start] Could not resolve migration automatically.");
        console.warn("[railway-start] You may need to manually run: prisma migrate resolve --rolled-back 0001_init");
        console.warn("[railway-start] Or set RESET_DB=true in Railway variables to reset the database.");
        // Continue anyway - the server has safeguards for missing DB
      }
    }
  }
} else {
  console.warn(
    "[railway-start] No database URL found (DATABASE_URL/POSTGRES_URL/etc). Skipping prisma migrate deploy."
  );
}

process.env.NODE_ENV = "production";

console.log("[railway-start] Starting server...");

const server = spawnSync("node", ["dist/server.js"], {
  stdio: "inherit",
  env: process.env,
});

process.exit(server.status ?? 0);
