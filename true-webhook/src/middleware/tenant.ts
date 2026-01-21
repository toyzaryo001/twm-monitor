// Tenant context middleware
import type { Request, Response, NextFunction } from 'express';
import { getMasterPrisma } from '../lib/prisma-master';
import { getTenantPrisma, type TenantPrismaClient } from '../lib/prisma-tenant';

declare global {
    namespace Express {
        interface Request {
            tenantContext?: {
                id: string;
                name: string;
                prefix: string;
                schemaName: string;
                prisma: TenantPrismaClient;
            };
        }
    }
}

/**
 * Middleware to load tenant context from URL prefix
 * Use for routes like /api/:prefix/accounts
 */
export function loadTenantFromPrefix(req: Request, res: Response, next: NextFunction) {
    const prefix = req.params.prefix;

    if (!prefix) {
        return res.status(400).json({ ok: false, error: 'MISSING_PREFIX' });
    }

    loadTenantContext(prefix, req, res, next);
}

/**
 * Middleware to load tenant context from authenticated user
 */
export function loadTenantFromUser(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
        return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    }

    // Master can access any tenant via query param or header
    if (req.user.role === 'MASTER') {
        const targetPrefix = req.query.prefix as string || req.headers['x-tenant-prefix'] as string;
        if (targetPrefix) {
            return loadTenantContext(targetPrefix, req, res, next);
        }
        // Master without specific tenant - continue without tenant context
        return next();
    }

    // Regular users access their assigned tenant
    if (!req.user.prefix) {
        return res.status(403).json({ ok: false, error: 'NO_TENANT_ASSIGNED' });
    }

    loadTenantContext(req.user.prefix, req, res, next);
}

async function loadTenantContext(prefix: string, req: Request, res: Response, next: NextFunction) {
    try {
        const masterPrisma = getMasterPrisma();

        const tenant = await masterPrisma.tenant.findUnique({
            where: { prefix },
        });

        if (!tenant) {
            return res.status(404).json({ ok: false, error: 'TENANT_NOT_FOUND' });
        }

        if (!tenant.isActive) {
            return res.status(403).json({ ok: false, error: 'TENANT_INACTIVE' });
        }

        // Check access for non-master users
        if (req.user && req.user.role !== 'MASTER') {
            if (req.user.tenantId !== tenant.id) {
                return res.status(403).json({ ok: false, error: 'TENANT_ACCESS_DENIED' });
            }
        }

        req.tenantContext = {
            id: tenant.id,
            name: tenant.name,
            prefix: tenant.prefix,
            schemaName: tenant.schemaName,
            prisma: getTenantPrisma(tenant.schemaName),
        };

        next();
    } catch (err) {
        next(err);
    }
}
