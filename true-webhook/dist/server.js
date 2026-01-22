"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const next_1 = __importDefault(require("next"));
const router_1 = __importDefault(require("./api/router"));
const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const app = (0, next_1.default)({ dev });
const handle = app.getRequestHandler();
async function main() {
    await app.prepare();
    const server = (0, express_1.default)();
    server.use((0, cors_1.default)());
    server.use(express_1.default.json());
    // Health check
    server.get("/api/health", (req, res) => {
        res.json({ ok: true, timestamp: new Date().toISOString() });
    });
    // API routes
    server.use("/api", router_1.default);
    // Next.js handler
    server.all("*", (req, res) => {
        return handle(req, res);
    });
    server.listen(port, () => {
        console.log(`[server] listening on http://localhost:${port} (dev=${dev})`);
    });
}
main().catch(console.error);
