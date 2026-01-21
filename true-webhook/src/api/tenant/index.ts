import { Router, Request, Response, NextFunction } from "express";
import accountsRouter from "./accounts";
import { requireAuth, requireNetworkAccess } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";

const router = Router({ mergeParams: true });

router.use(requireAuth, requireNetworkAccess);

// Accounts management
router.use("/accounts", accountsRouter);

// Dashboard stats
router.get("/stats", async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const network = await prisma.network.findUnique({
            where: { prefix: req.params.prefix },
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        const [accountCount, activeAccounts] = await Promise.all([
            prisma.account.count({ where: { networkId: network.id } }),
            prisma.account.count({ where: { networkId: network.id, isActive: true } }),
        ]);

        return res.json({
            ok: true,
            data: {
                network: { id: network.id, name: network.name, prefix: network.prefix },
                stats: { total: accountCount, active: activeAccounts },
            },
        });
    } catch (err) {
        next(err);
    }
});

export default router;
