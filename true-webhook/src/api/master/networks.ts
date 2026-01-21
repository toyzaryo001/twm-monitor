import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireMaster } from "../../middleware/auth";

const router = Router();

// All routes require Master auth
router.use(requireAuth, requireMaster);

// List all networks
router.get("/", async (req, res, next) => {
    try {
        const networks = await prisma.network.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                _count: { select: { users: true, accounts: true } },
            },
        });

        return res.json({ ok: true, data: networks });
    } catch (err) {
        next(err);
    }
});

// Get single network
router.get("/:id", async (req, res, next) => {
    try {
        const network = await prisma.network.findUnique({
            where: { id: req.params.id as string },
            include: {
                users: { select: { id: true, email: true, displayName: true, role: true } },
                _count: { select: { accounts: true } },
            },
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "NOT_FOUND" });
        }

        return res.json({ ok: true, data: network });
    } catch (err) {
        next(err);
    }
});

// Create network
router.post("/", async (req, res, next) => {
    try {
        const schema = z.object({
            prefix: z.string().min(2).max(30).regex(/^[a-z0-9_-]+$/),
            name: z.string().min(1),
        });

        const { prefix, name } = schema.parse(req.body);

        const existing = await prisma.network.findUnique({ where: { prefix } });
        if (existing) {
            return res.status(400).json({ ok: false, error: "PREFIX_EXISTS" });
        }

        const network = await prisma.network.create({
            data: { prefix, name },
        });

        return res.status(201).json({ ok: true, data: network });
    } catch (err) {
        next(err);
    }
});

// Update network
router.put("/:id", async (req, res, next) => {
    try {
        const schema = z.object({
            name: z.string().min(1).optional(),
            isActive: z.boolean().optional(),
        });

        const data = schema.parse(req.body);

        const network = await prisma.network.update({
            where: { id: req.params.id as string },
            data,
        });

        return res.json({ ok: true, data: network });
    } catch (err) {
        next(err);
    }
});

// Delete network
router.delete("/:id", async (req, res, next) => {
    try {
        await prisma.network.delete({ where: { id: req.params.id as string } });
        return res.status(204).send();
    } catch (err) {
        res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
});

export default router;
