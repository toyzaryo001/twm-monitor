import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { signToken, hashPassword, verifyPassword } from "../../lib/auth";
import { requireAuth } from "../../middleware/auth";

const router = Router();

// Login
router.post("/login", async (req, res, next) => {
    try {
        const schema = z.object({
            username: z.string().min(1),
            password: z.string().min(1),
        });

        const { username, password } = schema.parse(req.body);

        // Find user by email field (used as username)
        const user = await prisma.user.findUnique({ where: { email: username } });
        if (!user) {
            return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
        }

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
        }

        // Only allow MASTER role to login to Master Panel
        if (user.role !== "MASTER") {
            return res.status(403).json({ ok: false, error: "ACCESS_DENIED", message: "Only Master Admin can access this panel" });
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
                username: user.email,
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
            username: z.string().min(3),
            password: z.string().min(6),
        });

        const { username, password } = schema.parse(req.body);

        const passwordHash = await hashPassword(password);

        const user = await prisma.user.create({
            data: {
                email: username, // Store username in email field
                passwordHash,
                displayName: username,
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
                username: user.email,
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
                username: user.email,
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
