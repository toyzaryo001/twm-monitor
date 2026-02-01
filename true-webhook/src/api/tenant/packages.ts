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

export default router;
