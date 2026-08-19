import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { verifyPassword, signToken } from "../../lib/auth";
import { createRateLimit } from "../../middleware/rateLimit";
import { getLocalJga88Credentials } from "../../lib/runtimeConfig";

const router = Router({ mergeParams: true });
const loginRateLimit = createRateLimit({ name: "tenant_login", windowMs: 15 * 60 * 1000, max: 10 });

function isLocalJga88(prefix: string) {
    return process.env.LOCAL_JGA88_MODE === "true" && prefix === "jga88";
}

// Tenant Login (for network users)
router.post("/login", loginRateLimit, async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const schema = z.object({
            username: z.string().min(1),
            password: z.string().min(1),
        });

        const { username, password } = schema.parse(req.body);
        const prefix = req.params.prefix;

        if (isLocalJga88(prefix)) {
            const localCredentials = getLocalJga88Credentials();
            if (!localCredentials) {
                return res.status(503).json({ ok: false, error: "LOCAL_MODE_NOT_CONFIGURED" });
            }
            if (username.trim() !== localCredentials.username || password !== localCredentials.password) {
                return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
            }

            const token = signToken({
                userId: "local-jga88-user",
                email: localCredentials.username,
                role: "NETWORK_ADMIN",
                networkId: "local-jga88-network",
            }, 6 * 60 * 60 * 1000);

            return res.json({
                ok: true,
                data: {
                    token,
                    user: {
                        id: "local-jga88-user",
                        email: localCredentials.username,
                        displayName: "JGA88 Admin",
                        role: "NETWORK_ADMIN",
                        network: { id: "local-jga88-network", name: "JGA88", prefix: "jga88" },
                    },
                },
            });
        }

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
                email: username.trim(),
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
        // Generate token
        const token = signToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            networkId: user.networkId,
        }, 6 * 60 * 60 * 1000); // 6 hours expiration

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
        if (isLocalJga88(req.params.prefix)) {
            return res.json({
                ok: true,
                data: { name: "JGA88", isActive: true, logoUrl: null },
            });
        }

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
