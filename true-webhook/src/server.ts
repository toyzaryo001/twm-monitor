import "dotenv/config";
import express from "express";
import cors from "cors";
import next from "next";
import apiRouter from "./api/router";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

async function main() {
    await app.prepare();

    const server = express();

    server.use(cors());
    server.use(express.json());

    // Health check
    server.get("/api/health", (req, res) => {
        res.json({ ok: true, timestamp: new Date().toISOString() });
    });

    // API routes
    server.use("/api", apiRouter);

    // Next.js handler
    server.all("/{*path}", (req, res) => {
        return handle(req, res);
    });

    server.listen(port, () => {
        console.log(`[server] listening on http://localhost:${port} (dev=${dev})`);
    });
}

main().catch(console.error);
