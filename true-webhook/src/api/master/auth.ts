import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { signToken, hashPassword, verifyPassword } from "../../lib/auth";
import { requireAuth } from "../../middleware/auth";
import { createRateLimit } from "../../middleware/rateLimit";

const router = Router();
const loginRateLimit = createRateLimit({ name: "master_login", windowMs: 15 * 60 * 1000, max: 10 });
const setupRateLimit = createRateLimit({ name: "master_setup", windowMs: 60 * 60 * 1000, max: 5 });

// Login
router.post("/login", loginRateLimit, async (req, res, next) => {
    try {
        const schema = z.object({
            username: z.string().min(1),
            password: z.string().min(1),
        });

        const { username, password } = schema.parse(req.body);
        const normalizedUsername = username.trim();
        if (!normalizedUsername) {
            return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
        }

        // Find user by email field (used as username)
        const user = await prisma.user.findUnique({ where: { email: normalizedUsername } });
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
        }, 12 * 60 * 60 * 1000); // 12 hours expiration

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
router.post("/setup", setupRateLimit, async (req, res, next) => {
    try {
        const existingAdmin = await prisma.user.findFirst({
            where: { role: "MASTER" },
        });

        if (existingAdmin) {
            return res.status(400).json({ ok: false, error: "ADMIN_EXISTS" });
        }

        if (process.env.NODE_ENV === "production") {
            const expectedSecret = process.env.MASTER_SETUP_SECRET;
            const providedSecret = req.headers["x-setup-secret"] || req.body?.setupSecret;
            if (!expectedSecret || providedSecret !== expectedSecret) {
                return res.status(403).json({ ok: false, error: "SETUP_SECRET_REQUIRED" });
            }
        }

        const schema = z.object({
            username: z.string().min(3),
            password: z.string().min(6),
        });

        const { username, password } = schema.parse(req.body);
        const normalizedUsername = username.trim();
        if (normalizedUsername.length < 3) {
            return res.status(400).json({ ok: false, error: "USERNAME_TOO_SHORT" });
        }

        const passwordHash = await hashPassword(password);

        const user = await prisma.user.create({
            data: {
                email: normalizedUsername, // Store username in email field
                passwordHash,
                displayName: normalizedUsername,
                role: "MASTER",
            },
        });

        const token = signToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            networkId: null,
        }, 12 * 60 * 60 * 1000); // 12 hours expiration

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
        return res.json({
            ok: true,
            needsSetup: !existingAdmin,
            requiresSetupSecret: !existingAdmin && process.env.NODE_ENV === "production",
        });
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
