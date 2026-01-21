"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const accounts_1 = __importDefault(require("./accounts"));
const auth_1 = require("../../middleware/auth");
const prisma_1 = require("../../lib/prisma");
const router = (0, express_1.Router)({ mergeParams: true });
router.use(auth_1.requireAuth, auth_1.requireNetworkAccess);
// Accounts management
router.use("/accounts", accounts_1.default);
// Dashboard stats
router.get("/stats", async (req, res, next) => {
    try {
        const network = await prisma_1.prisma.network.findUnique({
            where: { prefix: req.params.prefix },
        });
        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }
        const [accountCount, activeAccounts] = await Promise.all([
            prisma_1.prisma.account.count({ where: { networkId: network.id } }),
            prisma_1.prisma.account.count({ where: { networkId: network.id, isActive: true } }),
        ]);
        return res.json({
            ok: true,
            data: {
                network: { id: network.id, name: network.name, prefix: network.prefix },
                stats: { total: accountCount, active: activeAccounts },
            },
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
