// Master Users Router
import { Router } from 'express';
import { z } from 'zod';
import { getMasterPrisma } from '../../lib/prisma-master';
import { hashPassword } from '../../lib/auth';
import { requireAuth, requireMaster } from '../../middleware/auth';

export const masterUsersRouter = Router();

// All routes require Master role
masterUsersRouter.use(requireAuth, requireMaster);

const createUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    displayName: z.string().optional(),
    role: z.enum(['MASTER', 'TENANT_ADMIN', 'TENANT_USER']).optional(),
    tenantId: z.string().optional(),
});

const updateUserSchema = z.object({
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    displayName: z.string().optional(),
    role: z.enum(['MASTER', 'TENANT_ADMIN', 'TENANT_USER']).optional(),
    tenantId: z.string().nullable().optional(),
});

// List all users
masterUsersRouter.get('/', async (req, res, next) => {
    try {
        const prisma = getMasterPrisma();

        const tenantId = req.query.tenantId as string | undefined;

        const users = await prisma.user.findMany({
            where: tenantId ? { tenantId } : undefined,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                tenantId: true,
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        prefix: true,
                    },
                },
                lastLoginAt: true,
                createdAt: true,
            },
        });

        return res.status(200).json({ ok: true, data: users });
    } catch (err) {
        next(err);
    }
});

// Get single user
masterUsersRouter.get('/:id', async (req, res, next) => {
    try {
        const prisma = getMasterPrisma();

        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                tenantId: true,
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        prefix: true,
                    },
                },
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            return res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
        }

        return res.status(200).json({ ok: true, data: user });
    } catch (err) {
        next(err);
    }
});

// Create user
masterUsersRouter.post('/', async (req, res, next) => {
    try {
        const prisma = getMasterPrisma();
        const body = createUserSchema.parse(req.body);

        // Check if email exists
        const existing = await prisma.user.findUnique({
            where: { email: body.email },
        });

        if (existing) {
            return res.status(400).json({ ok: false, error: 'EMAIL_ALREADY_EXISTS' });
        }

        // Validate tenant if provided
        if (body.tenantId) {
            const tenant = await prisma.tenant.findUnique({
                where: { id: body.tenantId },
            });
            if (!tenant) {
                return res.status(400).json({ ok: false, error: 'TENANT_NOT_FOUND' });
            }
        }

        const passwordHash = await hashPassword(body.password);

        const user = await prisma.user.create({
            data: {
                email: body.email,
                passwordHash,
                displayName: body.displayName,
                role: body.role ?? 'TENANT_USER',
                tenantId: body.tenantId,
            },
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                tenantId: true,
                createdAt: true,
            },
        });

        return res.status(201).json({ ok: true, data: user });
    } catch (err) {
        next(err);
    }
});

// Update user
masterUsersRouter.put('/:id', async (req, res, next) => {
    try {
        const prisma = getMasterPrisma();
        const body = updateUserSchema.parse(req.body);

        const existing = await prisma.user.findUnique({
            where: { id: req.params.id },
        });

        if (!existing) {
            return res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
        }

        // Check email uniqueness if changing
        if (body.email && body.email !== existing.email) {
            const emailExists = await prisma.user.findUnique({
                where: { email: body.email },
            });
            if (emailExists) {
                return res.status(400).json({ ok: false, error: 'EMAIL_ALREADY_EXISTS' });
            }
        }

        // Validate tenant if provided
        if (body.tenantId) {
            const tenant = await prisma.tenant.findUnique({
                where: { id: body.tenantId },
            });
            if (!tenant) {
                return res.status(400).json({ ok: false, error: 'TENANT_NOT_FOUND' });
            }
        }

        const updateData: any = {
            email: body.email,
            displayName: body.displayName,
            role: body.role,
        };

        if (body.tenantId !== undefined) {
            updateData.tenantId = body.tenantId;
        }

        if (body.password) {
            updateData.passwordHash = await hashPassword(body.password);
        }

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                tenantId: true,
                updatedAt: true,
            },
        });

        return res.status(200).json({ ok: true, data: user });
    } catch (err) {
        next(err);
    }
});

// Delete user
masterUsersRouter.delete('/:id', async (req, res, next) => {
    try {
        const prisma = getMasterPrisma();

        // Prevent deleting yourself
        if (req.user?.id === req.params.id) {
            return res.status(400).json({ ok: false, error: 'CANNOT_DELETE_SELF' });
        }

        await prisma.user.delete({ where: { id: req.params.id } });

        return res.status(204).send();
    } catch (err) {
        res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
    }
});
