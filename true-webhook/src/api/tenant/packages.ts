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

// Get bank info (from global settings)
router.get("/bank-info", async (req: any, res, next) => {
    try {
        const settings = await prisma.systemSetting.findMany({
            where: {
                key: { in: ["bankName", "bankAccountNumber", "bankAccountName"] }
            }
        });

        const data: Record<string, string> = {};
        settings.forEach(s => { data[s.key] = s.value; });

        return res.json({ ok: true, data });
    } catch (err) {
        next(err);
    }
});

export default router;
