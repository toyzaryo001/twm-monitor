import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { verifyPassword, signToken } from "../../lib/auth";

const router = Router({ mergeParams: true });

// Tenant Login (for network users)
router.post("/login", async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const schema = z.object({
            username: z.string().min(1),
            password: z.string().min(1),
        });

        const { username, password } = schema.parse(req.body);
        const prefix = req.params.prefix;

        // Find the network first
        const network = await prisma.network.findUnique({
            where: { prefix },
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        if (!network.isActive) {
            return res.status(403).json({ ok: false, error: "NETWORK_INACTIVE" });
        }

        // Find user by username (email field) that belongs to this network OR is MASTER
        const user = await prisma.user.findFirst({
            where: {
                email: username,
                OR: [
                    { networkId: network.id },
                    { role: "MASTER" }
                ]
            },
            include: { network: true },
        });

        if (!user) {
            return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
        }

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
        }

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        // Generate token
        const token = signToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            networkId: user.networkId,
        });

        return res.json({
            ok: true,
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    displayName: user.displayName,
                    role: user.role,
                    network: user.network ? { id: user.network.id, name: user.network.name, prefix: user.network.prefix } : null,
                },
            },
        });
    } catch (err) {
        next(err);
    }
});

// Check network status (public endpoint)
router.get("/status", async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const network = await prisma.network.findUnique({
            where: { prefix: req.params.prefix },
            select: { name: true, isActive: true, logoUrl: true },
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        return res.json({
            ok: true,
            data: { name: network.name, isActive: network.isActive, logoUrl: network.logoUrl },
        });
    } catch (err) {
        next(err);
    }
});

export default router;
