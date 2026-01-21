// Master Tenants Router
import { Router } from 'express';
import { z } from 'zod';
import { getMasterPrisma } from '../../lib/prisma-master';
import { provisionTenantSchema, deleteTenantSchema, getTenantPrisma } from '../../lib/prisma-tenant';
import { requireAuth, requireMaster } from '../../middleware/auth';

export const masterTenantsRouter = Router();

// All routes require Master role
masterTenantsRouter.use(requireAuth, requireMaster);

const createTenantSchema = z.object({
    name: z.string().min(1),
    prefix: z.string().min(2).max(20).regex(/^[a-z0-9_]+$/, 'Prefix must be lowercase alphanumeric with underscores'),
    maxAccounts: z.number().int().min(1).max(100).optional(),
    logoUrl: z.string().url().optional(),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const updateTenantSchema = createTenantSchema.partial().extend({
    isActive: z.boolean().optional(),
});

// List all tenants
masterTenantsRouter.get('/', async (req, res, next) => {
    try {
        const prisma = getMasterPrisma();

        const tenants = await prisma.tenant.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { users: true },
                },
            },
        });

        // Get account counts for each tenant
        const tenantsWithStats = await Promise.all(
            tenants.map(async (tenant) => {
                try {
                    const tenantPrisma = getTenantPrisma(tenant.schemaName);
                    const accountCount = await tenantPrisma.account.count();
                    return {
                        ...tenant,
                        userCount: tenant._count.users,
                        accountCount,
                    };
                } catch {
                    return {
                        ...tenant,
                        userCount: tenant._count.users,
                        accountCount: 0,
                    };
                }
            })
        );

        return res.status(200).json({ ok: true, data: tenantsWithStats });
    } catch (err) {
        next(err);
    }
});

// Get single tenant
masterTenantsRouter.get('/:id', async (req, res, next) => {
    try {
        const prisma = getMasterPrisma();

        const tenant = await prisma.tenant.findUnique({
            where: { id: req.params.id },
            include: {
                users: {
                    select: {
                        id: true,
                        email: true,
                        displayName: true,
                        role: true,
                        lastLoginAt: true,
                    },
                },
            },
        });

        if (!tenant) {
            return res.status(404).json({ ok: false, error: 'TENANT_NOT_FOUND' });
        }

        // Get stats from tenant schema
        let stats = { accountCount: 0, balanceTotal: 0 };
        try {
            const tenantPrisma = getTenantPrisma(tenant.schemaName);
            const accountCount = await tenantPrisma.account.count();
            stats = { accountCount, balanceTotal: 0 };
        } catch {
            // Schema might not exist yet
        }

        return res.status(200).json({
            ok: true,
            data: { ...tenant, stats },
        });
    } catch (err) {
        next(err);
    }
});

// Create tenant
masterTenantsRouter.post('/', async (req, res, next) => {
    try {
        const prisma = getMasterPrisma();
        const body = createTenantSchema.parse(req.body);

        // Check if prefix exists
        const existing = await prisma.tenant.findUnique({
            where: { prefix: body.prefix },
        });

        if (existing) {
            return res.status(400).json({ ok: false, error: 'PREFIX_ALREADY_EXISTS' });
        }

        const schemaName = `tenant_${body.prefix}`;

        // Create tenant in master DB
        const tenant = await prisma.tenant.create({
            data: {
                name: body.name,
                prefix: body.prefix,
                schemaName,
                maxAccounts: body.maxAccounts ?? 10,
                logoUrl: body.logoUrl,
                primaryColor: body.primaryColor,
            },
        });

        // Provision the tenant schema
        try {
            await provisionTenantSchema(schemaName);
        } catch (err) {
            // Rollback tenant creation if schema creation fails
            await prisma.tenant.delete({ where: { id: tenant.id } });
            throw err;
        }

        return res.status(201).json({ ok: true, data: tenant });
    } catch (err) {
        next(err);
    }
});

// Update tenant
masterTenantsRouter.put('/:id', async (req, res, next) => {
    try {
        const prisma = getMasterPrisma();
        const body = updateTenantSchema.parse(req.body);

        const existing = await prisma.tenant.findUnique({
            where: { id: req.params.id },
        });

        if (!existing) {
            return res.status(404).json({ ok: false, error: 'TENANT_NOT_FOUND' });
        }

        // Prefix cannot be changed
        if (body.prefix && body.prefix !== existing.prefix) {
            return res.status(400).json({ ok: false, error: 'PREFIX_CANNOT_BE_CHANGED' });
        }

        const tenant = await prisma.tenant.update({
            where: { id: req.params.id },
            data: {
                name: body.name,
                isActive: body.isActive,
                maxAccounts: body.maxAccounts,
                logoUrl: body.logoUrl,
                primaryColor: body.primaryColor,
            },
        });

        return res.status(200).json({ ok: true, data: tenant });
    } catch (err) {
        next(err);
    }
});

// Delete tenant
masterTenantsRouter.delete('/:id', async (req, res, next) => {
    try {
        const prisma = getMasterPrisma();

        const tenant = await prisma.tenant.findUnique({
            where: { id: req.params.id },
        });

        if (!tenant) {
            return res.status(404).json({ ok: false, error: 'TENANT_NOT_FOUND' });
        }

        // Delete tenant schema
        try {
            await deleteTenantSchema(tenant.schemaName);
        } catch {
            // Continue even if schema deletion fails
        }

        // Delete tenant (cascades to users)
        await prisma.tenant.delete({ where: { id: req.params.id } });

        return res.status(204).send();
    } catch (err) {
        next(err);
    }
});
