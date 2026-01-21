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
  console.log("[railway-start] DATABASE_URL detected; running migrations...");

  const prismaBin = process.platform === "win32" ? "prisma.cmd" : "prisma";
  const result = spawnSync(prismaBin, ["migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
} else {
  console.warn(
    "[railway-start] No database URL found (DATABASE_URL/POSTGRES_URL/etc). Skipping prisma migrate deploy."
  );
}

process.env.NODE_ENV = "production";

const server = spawnSync("node", ["dist/server.js"], {
  stdio: "inherit",
  env: process.env,
});

process.exit(server.status ?? 0);
