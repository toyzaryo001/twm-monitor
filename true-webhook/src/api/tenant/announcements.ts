import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma";

const router = Router({ mergeParams: true });

// GET / - Get active announcements for this tenant's network
router.get("/", async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const { prefix } = req.params;

        const network = await prisma.network.findUnique({
            where: { prefix },
            select: { id: true }
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "Network not found" });
        }

        const announcements = await (prisma as any).announcement.findMany({
            where: {
                isActive: true,
                OR: [
                    // Global announcements (no networks assigned)
                    { networks: { none: {} } },
                    // Specific announcements for this network
                    { networks: { some: { networkId: network.id } } }
                ]
            },
            orderBy: { createdAt: "desc" }
        });

        const formatted = announcements.map((a: any) => ({
            id: a.id,
            title: a.title,
            content: a.content,
            type: a.type,
            createdAt: a.createdAt
        }));

        res.json({ ok: true, data: formatted });
    } catch (err) {
        next(err);
    }
});

export default router;
