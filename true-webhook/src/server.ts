import "dotenv/config";
import express from "express";
import cors from "cors";
import next from "next";
import path from "path";
import apiRouter from "./api/router";
import { isWorkerRunning, startBalanceWorker, stopBalanceWorker } from "./workers/balanceWorker";
import { prisma } from "./lib/prisma";
import { logEvent } from "./lib/logging";
// Auto-Withdraw feature removed - TrueMoney API not accessible
// import { startAutoWithdrawWorker } from "./workers/autoWithdrawWorker";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

// Ensure Next.js finds the correct directory
const dir = process.cwd();
console.log("[server] Working directory:", dir);
console.log("[server] NODE_ENV:", process.env.NODE_ENV);

const app = next({ dev, dir });
const handle = app.getRequestHandler();

function getCorsOrigins() {
    return (process.env.CORS_ORIGINS || "")
        .split(",")
        .map(origin => origin.trim())
        .filter(Boolean);
}

function isAllowedOrigin(origin: string | undefined, hostHeader?: string | string[]) {
    if (!origin) return true;

    const configuredOrigins = getCorsOrigins();
    if (configuredOrigins.length > 0) {
        return configuredOrigins.includes(origin);
    }

    try {
        const url = new URL(origin);
        const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
        return origin === `https://${host}` ||
            origin === `http://${host}` ||
            url.hostname === "localhost" ||
            url.hostname === "127.0.0.1";
    } catch {
        return false;
    }
}

async function main() {
    console.log("[server] Preparing Next.js app...");
    await app.prepare();
    console.log("[server] Next.js app ready!");

    const server = express();

    server.use((req, res, nextMiddleware) => {
        cors({
            origin(origin, callback) {
                if (isAllowedOrigin(origin, req.headers.host)) return callback(null, true);
                return callback(new Error("CORS_ORIGIN_DENIED"));
            },
        })(req, res, nextMiddleware);
    });
    server.use(express.json({ limit: "1mb" }));
    server.use(express.urlencoded({ extended: false, limit: "1mb" }));
    server.use(express.text({ type: ["text/plain", "application/jwt"], limit: "1mb" }));

    // Serve uploaded files (slips)
    server.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

    // Health check
    server.get("/api/health", (req, res) => {
        res.json({ ok: true, timestamp: new Date().toISOString() });
    });

    server.get("/api/health/deep", async (req, res) => {
        const secret = process.env.HEALTH_CHECK_SECRET;
        const headerSecret = req.headers["x-health-secret"];
        const querySecret = typeof req.query.secret === "string" ? req.query.secret : "";
        const providedSecret = (Array.isArray(headerSecret) ? headerSecret[0] : headerSecret) ||
            req.headers.authorization?.replace(/^Bearer\s+/i, "") ||
            querySecret;

        if (!secret || providedSecret !== secret) {
            return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
        }

        try {
            await prisma.$queryRaw`SELECT 1`;
            return res.json({
                ok: true,
                timestamp: new Date().toISOString(),
                checks: {
                    db: "ok",
                    workerRunning: isWorkerRunning(),
                },
            });
        } catch (err) {
            logEvent("error", "health_deep_failed", { error: err instanceof Error ? err.message : String(err) });
            return res.status(503).json({
                ok: false,
                timestamp: new Date().toISOString(),
                checks: {
                    db: "error",
                    workerRunning: isWorkerRunning(),
                },
            });
        }
    });

    // API routes
    server.use("/api", apiRouter);

    // Next.js handler for all other routes
    server.all("*", (req, res) => {
        console.log(`[server] ${req.method} ${req.url}`);
        return handle(req, res);
    });

    const httpServer = server.listen(port, () => {
        console.log(`[server] listening on http://localhost:${port} (dev=${dev})`);

        if (process.env.DISABLE_BALANCE_WORKER === "true") {
            console.log("[server] Balance worker disabled by DISABLE_BALANCE_WORKER=true");
            return;
        }

        // Start the balance worker (uses per-network settings from database)
        void startBalanceWorker().catch((err) => {
            logEvent("error", "balance_worker_start_failed", { error: err instanceof Error ? err.message : String(err) });
        });

        // Auto-Withdraw feature removed
        // startAutoWithdrawWorker();
    });

    async function shutdown(signal: string) {
        logEvent("info", "server_shutdown_started", { signal });
        stopBalanceWorker();

        httpServer.close(async () => {
            try {
                await prisma.$disconnect();
                logEvent("info", "server_shutdown_complete", { signal });
                process.exit(0);
            } catch (err) {
                logEvent("error", "server_shutdown_failed", { error: err instanceof Error ? err.message : String(err) });
                process.exit(1);
            }
        });
    }

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
    console.error("[server] Failed to start:", err);
    process.exit(1);
});

