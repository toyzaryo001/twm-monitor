import "dotenv/config";
import express from "express";
import cors from "cors";
import next from "next";
import path from "path";
import apiRouter from "./api/router";
import { startBalanceWorker } from "./workers/balanceWorker";
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

async function main() {
    console.log("[server] Preparing Next.js app...");
    await app.prepare();
    console.log("[server] Next.js app ready!");

    const server = express();

    server.use(cors());
    server.use(express.json());

    // Serve uploaded files (slips)
    server.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

    // Health check
    server.get("/api/health", (req, res) => {
        res.json({ ok: true, timestamp: new Date().toISOString() });
    });

    // API routes
    server.use("/api", apiRouter);

    // Next.js handler for all other routes
    server.all("*", (req, res) => {
        console.log(`[server] ${req.method} ${req.url}`);
        return handle(req, res);
    });

    server.listen(port, () => {
        console.log(`[server] listening on http://localhost:${port} (dev=${dev})`);

        // Start the balance worker (uses per-network settings from database)
        startBalanceWorker();

        // Auto-Withdraw feature removed
        // startAutoWithdrawWorker();
    });
}

main().catch((err) => {
    console.error("[server] Failed to start:", err);
    process.exit(1);
});

