"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("./auth"));
const networks_1 = __importDefault(require("./networks"));
const users_1 = __importDefault(require("./users"));
const auth_2 = require("../../middleware/auth");
const prisma_1 = require("../../lib/prisma");
const router = (0, express_1.Router)();
// Auth routes (no auth required)
router.use("/auth", auth_1.default);
// Networks management
router.use("/networks", networks_1.default);
// Users management
router.use("/users", users_1.default);
// Dashboard overview
router.get("/overview", auth_2.requireAuth, auth_2.requireMaster, async (req, res, next) => {
    try {
        const [networkCount, userCount, accountCount] = await Promise.all([
            prisma_1.prisma.network.count(),
            prisma_1.prisma.user.count(),
            prisma_1.prisma.account.count(),
        ]);
        const recentNetworks = await prisma_1.prisma.network.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { accounts: true } } },
        });
        return res.json({
            ok: true,
            data: {
                stats: { networks: networkCount, users: userCount, accounts: accountCount },
                recentNetworks,
            },
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
