// Auth middleware for JWT validation
import type { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../lib/auth';
import { getMasterPrisma } from '../lib/prisma-master';

export interface AuthUser {
    id: string;
    email: string;
    role: 'MASTER' | 'TENANT_ADMIN' | 'TENANT_USER';
    tenantId?: string;
    prefix?: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

/**
 * Middleware to require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    }

    const token = authHeader.slice(7);
    const payload = verifyJWT(token);

    if (!payload) {
        return res.status(401).json({ ok: false, error: 'INVALID_TOKEN' });
    }

    req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role as AuthUser['role'],
        tenantId: payload.tenantId,
        prefix: payload.prefix,
    };

    next();
}

/**
 * Middleware to require MASTER role
 */
export function requireMaster(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
        return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    }

    if (req.user.role !== 'MASTER') {
        return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
    }

    next();
}

/**
 * Middleware to require tenant access (TENANT_ADMIN or TENANT_USER)
 */
export function requireTenantAccess(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
        return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    }

    // Master has access to everything
    if (req.user.role === 'MASTER') {
        return next();
    }

    // Check if user has tenant assigned
    if (!req.user.tenantId) {
        return res.status(403).json({ ok: false, error: 'NO_TENANT_ACCESS' });
    }

    next();
}

/**
 * Middleware to require tenant admin or master
 */
export function requireTenantAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
        return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    }

    if (req.user.role === 'MASTER' || req.user.role === 'TENANT_ADMIN') {
        return next();
    }

    return res.status(403).json({ ok: false, error: 'FORBIDDEN' });
}
