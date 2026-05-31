import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth";
import { prisma } from "../lib/prisma";

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

export async function requireNetworkAccess(req: Request, res: Response, next: NextFunction) {
    const { prefix } = req.params;

    // Master can access all networks
    if (req.user?.role === "MASTER") {
        return next();
    }

    if (req.user?.role === "NETWORK_ADMIN" || req.user?.role === "NETWORK_USER") {
        if (!req.user.networkId) {
            return res.status(403).json({ ok: false, error: "NETWORK_ACCESS_DENIED" });
        }

        try {
            const network = await prisma.network.findUnique({
                where: { prefix },
                select: { id: true },
            });

            if (!network) {
                return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
            }

            if (network.id !== req.user.networkId) {
                return res.status(403).json({ ok: false, error: "NETWORK_ACCESS_DENIED" });
            }

            return next();
        } catch (err) {
            return next(err);
        }
    }

    return res.status(403).json({ ok: false, error: "NETWORK_ACCESS_DENIED" });
}
