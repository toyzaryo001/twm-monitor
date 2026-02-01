import { Router } from "express";
import authRouter from "./auth";
import networksRouter from "./networks";
import usersRouter from "./users";
import { requireAuth, requireMaster } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";

const router = Router();

// Auth routes (no auth required)
router.use("/auth", authRouter);

// Networks management
router.use("/networks", networksRouter);

// Networks management
router.use("/networks", networksRouter);

import settingsRouter from "./settings";
import announcementsRouter from "./announcements";
import packagesRouter from "./packages";
import paymentsRouter from "./payments";

// Users management
router.use("/users", usersRouter);

// Settings management
router.use("/settings", settingsRouter);

// Announcement management
router.use("/announcements", announcementsRouter);

// Pricing & Payments
router.use("/packages", packagesRouter);
router.use("/payments", paymentsRouter);

// Dashboard overview
router.get("/overview", requireAuth, requireMaster, async (req, res, next) => {
    try {
        const [networkCount, userCount, accountCount] = await Promise.all([
            prisma.network.count(),
            prisma.user.count(),
            prisma.account.count(),
        ]);

        const recentNetworks = await prisma.network.findMany({
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
    } catch (err) {
        next(err);
    }
});

export default router;
