// Tenant API Router - combines all tenant-scoped routes
import { Router } from 'express';

import { tenantAccountsRouter } from './accounts.router';
import { tenantTelegramRouter } from './telegram.router';

export const tenantRouter = Router({ mergeParams: true });

// Accounts management
tenantRouter.use('/accounts', tenantAccountsRouter);

// Telegram integration
tenantRouter.use('/telegram', tenantTelegramRouter);

// Tenant dashboard stats
tenantRouter.get('/stats', async (req, res, next) => {
    try {
        // Note: tenant context should be loaded by parent route
        if (!req.tenantContext) {
            return res.status(400).json({ ok: false, error: 'TENANT_CONTEXT_REQUIRED' });
        }

        const prisma = req.tenantContext.prisma;

        const [accountCount, activeAccounts, notificationCount] = await Promise.all([
            prisma.account.count(),
            prisma.account.count({ where: { isActive: true } }),
            prisma.notificationLog.count(),
        ]);

        return res.status(200).json({
            ok: true,
            data: {
                tenant: {
                    id: req.tenantContext.id,
                    name: req.tenantContext.name,
                    prefix: req.tenantContext.prefix,
                },
                accountCount,
                activeAccounts,
                notificationCount,
            },
        });
    } catch (err) {
        next(err);
    }
});
