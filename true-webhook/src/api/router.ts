import { Router } from "express";
import masterRouter from "./master";
import tenantRouter from "./tenant";
import cronRouter from "./cron";
import sseRouter from "./sse";
import { getAppVersionInfo } from "../lib/version";

const router = Router();
const APP_ROOT = (process.env.APP_ROOT || "auto").toLowerCase();
const TENANT_PREFIX = (process.env.TENANT_PREFIX || "").toLowerCase();

router.use((req, res, next) => {
    if (APP_ROOT === "master" && req.path.startsWith("/tenant")) {
        return res.status(404).json({ ok: false, error: "TENANT_API_DISABLED_ON_MASTER_ROOT" });
    }

    if (APP_ROOT === "tenant" && req.path.startsWith("/master")) {
        return res.status(404).json({ ok: false, error: "MASTER_API_DISABLED_ON_TENANT_ROOT" });
    }

    if (APP_ROOT === "tenant" && TENANT_PREFIX && req.path.startsWith("/tenant/")) {
        const prefix = req.path.split("/")[2]?.toLowerCase();
        if (prefix && prefix !== TENANT_PREFIX) {
            return res.status(404).json({ ok: false, error: "TENANT_PREFIX_MISMATCH" });
        }
    }

    next();
});

// Version info
router.get("/version", (req, res) => {
    res.json({ ...getAppVersionInfo(), name: "True Webhook Monitor" });
});

// Master routes
router.use("/master", masterRouter);

// Tenant routes
router.use("/tenant/:prefix", tenantRouter);

// Cron routes (for Railway Cron jobs)
router.use("/cron", cronRouter);

// SSE routes (for real-time updates)
router.use("/sse", sseRouter);

// Webhook routes (TrueMoney Integration)
import webhookRouter from "./webhook";
router.use("/webhook", webhookRouter);

export default router;


