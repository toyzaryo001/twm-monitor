import { Router } from "express";
import masterRouter from "./master";
import tenantRouter from "./tenant";

const router = Router();

// Version info
router.get("/version", (req, res) => {
    res.json({ version: "1.0.0", name: "True Webhook Monitor" });
});

// Master routes
router.use("/master", masterRouter);

// Tenant routes
router.use("/tenant/:prefix", tenantRouter);

export default router;
