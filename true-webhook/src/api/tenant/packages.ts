import { Router } from "express";
import { prisma } from "../../lib/prisma";

const router = Router({ mergeParams: true });

// List active packages
router.get("/", async (req, res, next) => {
    try {
        const packages = await (prisma as any).package.findMany({
            where: { isActive: true },
            orderBy: { price: "asc" }
        });
        return res.json({ ok: true, data: packages });
    } catch (err) {
        next(err);
    }
});

// Get bank info for the network
router.get("/bank-info", async (req: any, res, next) => {
    try {
        const prefix = req.params.prefix;
        const network = await (prisma.network as any).findUnique({
            where: { prefix },
            select: {
                bankName: true,
                bankAccountNumber: true,
                bankAccountName: true,
            }
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "Network not found" });
        }

        return res.json({ ok: true, data: network });
    } catch (err) {
        next(err);
    }
});

export default router;
