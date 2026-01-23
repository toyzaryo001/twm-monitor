import { Router } from "express";
import masterRouter from "./master";
import tenantRouter from "./tenant";
import cronRouter from "./cron";
import sseRouter from "./sse";

const router = Router();

// Version info
router.get("/version", (req, res) => {
    res.json({ version: "1.0.0", name: "True Webhook Monitor" });
});

// Master routes
router.use("/master", masterRouter);

// Tenant routes
router.use("/tenant/:prefix", tenantRouter);

// Cron routes (for Railway Cron jobs)
router.use("/cron", cronRouter);

// SSE routes (for real-time updates)
router.use("/sse", sseRouter);

export default router;


