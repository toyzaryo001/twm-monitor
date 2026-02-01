import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireMaster } from "../../middleware/auth";

const router = Router();

// Ensure all routes require Master authentication
router.use(requireAuth, requireMaster);

// GET / - List all announcements
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const announcements = await (prisma as any).announcement.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                networks: {
                    include: {
                        network: {
                            select: { id: true, name: true, prefix: true }
                        }
                    }
                }
            }
        });

        // Format response to be cleaner for UI
        const formatted = announcements.map(a => ({
            id: a.id,
            title: a.title,
            content: a.content,
            type: a.type,
            isActive: a.isActive,
            createdAt: a.createdAt,
            scope: a.networks.length > 0 ? "SPECIFIC" : "GLOBAL",
            targetNetworks: a.networks.map(an => an.network)
        }));

        res.json({ ok: true, data: formatted });
    } catch (err) {
        next(err);
    }
});

// POST / - Create new announcement
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { title, content, type, isActive, networkIds } = req.body;

        if (!title || !content || !type) {
            return res.status(400).json({ ok: false, error: "Missing required fields" });
        }

        const announcement = await (prisma as any).announcement.create({
            data: {
                title,
                content,
                type,
                isActive: isActive ?? true,
                networks: {
                    create: Array.isArray(networkIds) && networkIds.length > 0
                        ? networkIds.map((id: string) => ({ networkId: id }))
                        : []
                }
            },
            include: {
                networks: { include: { network: true } }
            }
        });

        res.json({ ok: true, data: announcement });
    } catch (err) {
        next(err);
    }
});

// PUT /:id - Update announcement
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { title, content, type, isActive, networkIds } = req.body;

        // First handle basic updates
        const updateData: any = {};
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (type !== undefined) updateData.type = type;
        if (isActive !== undefined) updateData.isActive = isActive;

        // Transaction to handle network updates if provided
        await prisma.$transaction(async (tx) => {
            await (tx as any).announcement.update({
                where: { id },
                data: updateData
            });

            if (Array.isArray(networkIds)) {
                // Remove existing connections
                await (tx as any).announcementNetwork.deleteMany({
                    where: { announcementId: id }
                });

                // Create new connections
                if (networkIds.length > 0) {
                    await (tx as any).announcementNetwork.createMany({
                        data: networkIds.map((nid: string) => ({
                            announcementId: id,
                            networkId: nid
                        }))
                    });
                }
            }
        });

        const updated = await (prisma as any).announcement.findUnique({
            where: { id },
            include: { networks: { include: { network: true } } }
        });

        res.json({ ok: true, data: updated });
    } catch (err) {
        next(err);
    }
});

// DELETE /:id - Delete announcement
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        await (prisma as any).announcement.delete({
            where: { id: req.params.id }
        });

        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

// POST /:id/toggle - Quick toggle status
router.post("/:id/toggle", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const announcement = await (prisma as any).announcement.findUnique({ where: { id } });

        if (!announcement) {
            return res.status(404).json({ ok: false, error: "Not found" });
        }

        const updated = await (prisma as any).announcement.update({
            where: { id },
            data: { isActive: !announcement.isActive }
        });

        res.json({ ok: true, data: updated });
    } catch (err) {
        next(err);
    }
});

export default router;
