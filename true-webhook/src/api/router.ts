import { Router } from 'express';

import { accountsRouter } from './accounts.router';
import { telegramRouter } from './telegram.router';
import { masterRouter } from './master';
import { tenantRouter } from './tenant';
import { loadTenantFromPrefix } from '../middleware/tenant';
import { requireAuth, requireTenantAccess } from '../middleware/auth';

export const apiRouter = Router();

apiRouter.get('/version', (_req, res) => {
  res.status(200).json({
    name: 'twm-monitor',
    version: '0.2.0',
    features: ['multi-tenant', 'jwt-auth'],
  });
});

// Master API routes (/api/master/...)
apiRouter.use('/master', masterRouter);

// Tenant-scoped routes (/api/:prefix/...)
apiRouter.use('/:prefix', requireAuth, requireTenantAccess, loadTenantFromPrefix, tenantRouter);

// Legacy routes (will be deprecated - use tenant routes instead)
apiRouter.use('/accounts', accountsRouter);
apiRouter.use('/telegram', telegramRouter);

