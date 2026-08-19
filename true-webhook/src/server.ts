import "dotenv/config";
import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import next from "next";
import path from "path";
import apiRouter from "./api/router";
import { getWorkerStatus, startBalanceWorker, stopBalanceWorker } from "./workers/balanceWorker";
import { prisma } from "./lib/prisma";
import { logEvent } from "./lib/logging";
import { validateRuntimeConfig } from "./lib/runtimeConfig";
import { securityHeaders } from "./middleware/security";
// Auto-Withdraw feature removed - TrueMoney API not accessible
// import { startAutoWithdrawWorker } from "./workers/autoWithdrawWorker";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const appRoot = (process.env.APP_ROOT || "auto").toLowerCase();

function isBalanceWorkerDisabled() {
    return process.env.DISABLE_BALANCE_WORKER === "true" || appRoot === "master";
}

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
    validateRuntimeConfig();
    console.log("[server] Preparing Next.js app...");
    await app.prepare();
    console.log("[server] Next.js app ready!");

    const server = express();
    server.set("trust proxy", 1);
    server.disable("x-powered-by");
    server.use(securityHeaders);

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
            const worker = getWorkerStatus();
            const workerDisabled = isBalanceWorkerDisabled();
            const lastSuccessMs = worker.lastSuccessfulRunAt
                ? new Date(worker.lastSuccessfulRunAt).getTime()
                : 0;
            const workerStale = !workerDisabled && worker.configuredNetworks > 0 &&
                (!lastSuccessMs || Date.now() - lastSuccessMs > 10 * 60 * 1000);
            return res.status(workerStale ? 503 : 200).json({
                ok: !workerStale,
                timestamp: new Date().toISOString(),
                checks: {
                    db: "ok",
                    worker: {
                        ...worker,
                        disabled: workerDisabled,
                        stale: workerStale,
                    },
                },
            });
        } catch (err) {
            logEvent("error", "health_deep_failed", { error: err instanceof Error ? err.message : String(err) });
            return res.status(503).json({
                ok: false,
                timestamp: new Date().toISOString(),
                checks: {
                    db: "error",
                    worker: getWorkerStatus(),
                },
            });
        }
    });

    // API routes
    server.use("/api", apiRouter);

    const apiErrorHandler: ErrorRequestHandler = (err, req, res, nextMiddleware) => {
        if (!req.path.startsWith("/api")) return nextMiddleware(err);

        const errorName = err instanceof Error ? err.name : "UnknownError";
        const errorMessage = err instanceof Error ? err.message : String(err);
        const status = errorName === "ZodError" || errorName === "MulterError"
            ? 400
            : errorMessage === "CORS_ORIGIN_DENIED"
                ? 403
                : 500;

        logEvent(status >= 500 ? "error" : "warn", "api_request_failed", {
            method: req.method,
            path: req.path,
            status,
            error: errorMessage,
        });
        return res.status(status).json({
            ok: false,
            error: status === 500 ? "INTERNAL_SERVER_ERROR" : errorMessage,
        });
    };
    server.use(apiErrorHandler);

    // Next.js handler for all other routes
    server.all("*", (req, res) => {
        console.log(`[server] ${req.method} ${req.url}`);
        return handle(req, res);
    });

    const httpServer = server.listen(port, () => {
        console.log(`[server] listening on http://localhost:${port} (dev=${dev})`);

        if (isBalanceWorkerDisabled()) {
            console.log(`[server] Balance worker disabled (APP_ROOT=${appRoot})`);
            return;
        }

        // Start the balance worker (uses per-network settings from database)
        void startBalanceWorker().catch((err) => {
            logEvent("error", "balance_worker_start_failed", { error: err instanceof Error ? err.message : String(err) });
        });

        // Auto-Withdraw feature removed
        // startAutoWithdrawWorker();
    });

    let shuttingDown = false;
    async function shutdown(signal: string) {
        if (shuttingDown) return;
        shuttingDown = true;
        logEvent("info", "server_shutdown_started", { signal });
        stopBalanceWorker();

        const forceShutdown = setTimeout(() => {
            logEvent("error", "server_shutdown_forced", { signal });
            httpServer.closeAllConnections();
            void prisma.$disconnect().finally(() => process.exit(1));
        }, 10_000);
        forceShutdown.unref();

        httpServer.close(async () => {
            clearTimeout(forceShutdown);
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

