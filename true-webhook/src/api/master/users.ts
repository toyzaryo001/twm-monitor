import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../../lib/auth";
import { requireAuth, requireMaster } from "../../middleware/auth";

const router = Router();

router.use(requireAuth, requireMaster);

// List all users
router.get("/", async (req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                networkId: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true,
                network: { select: { id: true, name: true, prefix: true } },
            },
        });

        return res.json({ ok: true, data: users });
    } catch (err) {
        next(err);
    }
});

// Create user
router.post("/", async (req, res, next) => {
    try {
        const schema = z.object({
            email: z.string().min(3),
            password: z.string().min(6),
            displayName: z.string().optional(),
            role: z.enum(["MASTER", "NETWORK_ADMIN", "NETWORK_USER"]),
            networkId: z.string().optional().nullable(),
        });

        const { email, password, displayName, role, networkId } = schema.parse(req.body);

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(400).json({ ok: false, error: "EMAIL_EXISTS" });
        }

        const passwordHash = await hashPassword(password);

        const user = await prisma.user.create({
            data: { email, passwordHash, displayName, role, networkId },
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                networkId: true,
                createdAt: true,
                network: { select: { id: true, name: true } },
            },
        });

        return res.status(201).json({ ok: true, data: user });
    } catch (err) {
        next(err);
    }
});

// Update user
router.put("/:id", async (req, res, next) => {
    try {
        const schema = z.object({
            displayName: z.string().optional(),
            role: z.enum(["MASTER", "NETWORK_ADMIN", "NETWORK_USER"]).optional(),
            networkId: z.string().nullable().optional(),
            password: z.string().min(6).optional(),
        });

        const data = schema.parse(req.body);

        const updateData: Record<string, unknown> = { ...data };
        if (data.password) {
            updateData.passwordHash = await hashPassword(data.password);
            delete updateData.password;
        }

        const user = await prisma.user.update({
            where: { id: req.params.id as string },
            data: updateData,
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                networkId: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return res.json({ ok: true, data: user });
    } catch (err) {
        next(err);
    }
});

// Delete user
router.delete("/:id", async (req, res, next) => {
    try {
        await prisma.user.delete({ where: { id: req.params.id as string } });
        return res.status(204).send();
    } catch (err) {
        res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
});

export default router;
