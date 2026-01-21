// Master API Router - combines all master routes
import { Router } from 'express';

import { masterAuthRouter } from './auth.router';
import { masterTenantsRouter } from './tenants.router';
import { masterUsersRouter } from './users.router';

export const masterRouter = Router();

// Auth routes (login, setup, etc.)
masterRouter.use('/auth', masterAuthRouter);

// Tenant management
masterRouter.use('/tenants', masterTenantsRouter);

// User management
masterRouter.use('/users', masterUsersRouter);

// Master overview/stats endpoint
masterRouter.get('/overview', async (req, res, next) => {
    try {
        const { getMasterPrisma } = await import('../../lib/prisma-master');
        const prisma = getMasterPrisma();

        const [tenantCount, userCount, activeTenants] = await Promise.all([
            prisma.tenant.count(),
            prisma.user.count(),
            prisma.tenant.count({ where: { isActive: true } }),
        ]);

        return res.status(200).json({
            ok: true,
            data: {
                tenantCount,
                activeTenants,
                userCount,
            },
        });
    } catch (err) {
        next(err);
    }
});
