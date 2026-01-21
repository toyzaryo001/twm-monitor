import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { signToken, hashPassword, verifyPassword } from "../../lib/auth";
import { requireAuth, requireMaster } from "../../middleware/auth";

const router = Router();

// Login
router.post("/login", async (req, res, next) => {
    try {
        const schema = z.object({
            email: z.string().email(),
            password: z.string().min(1),
        });

        const { email, password } = schema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
        }

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
        }

        const token = signToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            networkId: user.networkId,
        });

        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        return res.json({
            ok: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                networkId: user.networkId,
            },
        });
    } catch (err) {
        next(err);
    }
});

// Initial setup (create first admin)
router.post("/setup", async (req, res, next) => {
    try {
        const existingAdmin = await prisma.user.findFirst({
            where: { role: "MASTER" },
        });

        if (existingAdmin) {
            return res.status(400).json({ ok: false, error: "ADMIN_EXISTS" });
        }

        const schema = z.object({
            email: z.string().email(),
            password: z.string().min(6),
            displayName: z.string().optional(),
        });

        const { email, password, displayName } = schema.parse(req.body);

        const passwordHash = await hashPassword(password);

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                displayName: displayName || "Master Admin",
                role: "MASTER",
            },
        });

        const token = signToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            networkId: null,
        });

        return res.status(201).json({
            ok: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
            },
        });
    } catch (err) {
        next(err);
    }
});

// Check if setup is needed
router.get("/setup-status", async (req, res, next) => {
    try {
        const existingAdmin = await prisma.user.findFirst({
            where: { role: "MASTER" },
        });
        return res.json({ ok: true, needsSetup: !existingAdmin });
    } catch (err) {
        next(err);
    }
});

// Get current user
router.get("/me", requireAuth, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.userId },
            include: { network: true },
        });

        if (!user) {
            return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
        }

        return res.json({
            ok: true,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                network: user.network,
            },
        });
    } catch (err) {
        next(err);
    }
});

export default router;
