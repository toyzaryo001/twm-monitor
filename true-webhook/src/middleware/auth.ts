import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth";

declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                email: string;
                role: string;
                networkId?: string | null;
            };
        }
    }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
        return res.status(401).json({ ok: false, error: "INVALID_TOKEN" });
    }

    req.user = payload;
    next();
}

export function requireMaster(req: Request, res: Response, next: NextFunction) {
    if (req.user?.role !== "MASTER") {
        return res.status(403).json({ ok: false, error: "MASTER_REQUIRED" });
    }
    next();
}

export function requireNetworkAccess(req: Request, res: Response, next: NextFunction) {
    const { prefix } = req.params;

    // Master can access all networks
    if (req.user?.role === "MASTER") {
        return next();
    }

    // Check if user belongs to this network (by prefix lookup needed)
    // For now, allow NETWORK_ADMIN and NETWORK_USER
    if (req.user?.role === "NETWORK_ADMIN" || req.user?.role === "NETWORK_USER") {
        return next();
    }

    return res.status(403).json({ ok: false, error: "NETWORK_ACCESS_DENIED" });
}
