"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const next_1 = __importDefault(require("next"));
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
const router_1 = require("./api/router");
const dev = process.env.NODE_ENV !== 'production';
// When compiled to dist/, __dirname becomes <project>/dist
// When running in dev (ts-node-dev), __dirname is <project>/src
const projectDir = path_1.default.join(__dirname, '..');
const nextApp = (0, next_1.default)({
    dev,
    dir: projectDir,
});
const handle = nextApp.getRequestHandler();
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
async function main() {
    await nextApp.prepare();
    const app = (0, express_1.default)();
    app.disable('x-powered-by');
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: '1mb' }));
    app.get('/api/health', (_req, res) => {
        res.status(200).json({
            ok: true,
            service: 'true-webhook',
            env: process.env.NODE_ENV ?? 'development',
            timestamp: new Date().toISOString(),
        });
    });
    app.use('/api', router_1.apiRouter);
    app.use((err, _req, res, _next) => {
        if (err instanceof zod_1.ZodError) {
            return res.status(400).json({
                ok: false,
                error: 'VALIDATION_ERROR',
                details: err.issues,
            });
        }
        return res.status(500).json({
            ok: false,
            error: 'INTERNAL_SERVER_ERROR',
        });
    });
    // Next.js handles everything else
    app.all('*', (req, res) => handle(req, res));
    app.listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`[server] listening on http://localhost:${port} (dev=${dev})`);
    });
}
main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[server] fatal error', err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map