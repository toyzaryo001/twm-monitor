// Master Auth Router
import { Router } from 'express';
import { z } from 'zod';
import { getMasterPrisma } from '../../lib/prisma-master';
import { hashPassword, verifyPassword, signJWT, generateRefreshToken } from '../../lib/auth';
import { requireAuth, requireMaster } from '../../middleware/auth';

export const masterAuthRouter = Router();

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    displayName: z.string().optional(),
});

// Login
masterAuthRouter.post('/login', async (req, res, next) => {
    try {
        const prisma = getMasterPrisma();
        const body = loginSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { email: body.email },
            include: { tenant: true },
        });

        if (!user) {
            return res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
        }

        const valid = await verifyPassword(body.password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
        }

        // Generate tokens
        const accessToken = signJWT({
            sub: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId ?? undefined,
            prefix: user.tenant?.prefix,
        });

        const refreshToken = generateRefreshToken();

        // Save refresh token
        await prisma.user.update({
            where: { id: user.id },
            data: {
                refreshToken,
                lastLoginAt: new Date(),
            },
        });

        return res.status(200).json({
            ok: true,
            data: {
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    displayName: user.displayName,
                    tenantId: user.tenantId,
                    prefix: user.tenant?.prefix,
                },
            },
        });
    } catch (err) {
        next(err);
    }
});

// Get current user
masterAuthRouter.get('/me', requireAuth, async (req, res, next) => {
    try {
        const prisma = getMasterPrisma();

        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            include: { tenant: true },
        });

        if (!user) {
            return res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
        }

        return res.status(200).json({
            ok: true,
            data: {
                id: user.id,
                email: user.email,
                role: user.role,
                displayName: user.displayName,
                tenantId: user.tenantId,
                tenant: user.tenant ? {
                    id: user.tenant.id,
                    name: user.tenant.name,
                    prefix: user.tenant.prefix,
                } : null,
            },
        });
    } catch (err) {
        next(err);
    }
});

// Create initial master user (only if no users exist)
masterAuthRouter.post('/setup', async (req, res, next) => {
    try {
        const prisma = getMasterPrisma();
        const body = registerSchema.parse(req.body);

        // Check if any users exist
        const userCount = await prisma.user.count();
        if (userCount > 0) {
            return res.status(400).json({ ok: false, error: 'SETUP_ALREADY_COMPLETE' });
        }

        const passwordHash = await hashPassword(body.password);

        const user = await prisma.user.create({
            data: {
                email: body.email,
                passwordHash,
                role: 'MASTER',
                displayName: body.displayName ?? 'System Admin',
            },
        });

        return res.status(201).json({
            ok: true,
            data: {
                id: user.id,
                email: user.email,
                role: user.role,
                displayName: user.displayName,
            },
        });
    } catch (err) {
        next(err);
    }
});

// Logout (invalidate refresh token)
masterAuthRouter.post('/logout', requireAuth, async (req, res, next) => {
    try {
        const prisma = getMasterPrisma();

        await prisma.user.update({
            where: { id: req.user!.id },
            data: { refreshToken: null },
        });

        return res.status(200).json({ ok: true });
    } catch (err) {
        next(err);
    }
});
