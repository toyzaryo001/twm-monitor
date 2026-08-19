import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireMaster } from "../../middleware/auth";
import { hashPassword } from "../../lib/auth";
import { logEvent } from "../../lib/logging";

const router = Router();

// All routes require Master auth
router.use(requireAuth, requireMaster);

// List all networks with balances
router.get("/", async (req, res, next) => {
    try {
        const networks = await prisma.network.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                _count: { select: { users: true, accounts: true } },
                accounts: {
                    where: { isActive: true },
                    select: { id: true },
                },
            },
        });

        // Get latest balance for each active account
        const networksWithBalance = await Promise.all(
            networks.map(async (network) => {
                let totalBalance = 0;

                if (network.accounts.length > 0) {
                    const accountIds = network.accounts.map(a => a.id);

                    // Get latest balance snapshot for each account
                    const latestSnapshots = await prisma.$queryRaw<{ balanceSatang: bigint }[]>`
                        SELECT DISTINCT ON ("accountId") "balanceSatang"
                        FROM "BalanceSnapshot"
                        WHERE "accountId" = ANY(${accountIds})
                        ORDER BY "accountId", "checkedAt" DESC
                    `;

                    totalBalance = latestSnapshots.reduce(
                        (sum, s) => sum + Number(s.balanceSatang),
                        0
                    );
                }

                // Remove accounts from response
                const { accounts, ...networkData } = network;

                return {
                    ...networkData,
                    totalBalance: totalBalance / 100, // Convert to baht
                };
            })
        );

        return res.json({ ok: true, data: networksWithBalance });
    } catch (err) {
        next(err);
    }
});

// Get single network
router.get("/:id", async (req, res, next) => {
    try {
        const network = await prisma.network.findUnique({
            where: { id: req.params.id as string },
            include: {
                users: { select: { id: true, email: true, displayName: true, role: true } },
                _count: { select: { accounts: true } },
            },
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "NOT_FOUND" });
        }

        return res.json({ ok: true, data: network });
    } catch (err) {
        next(err);
    }
});

// Create network
router.post("/", async (req, res, next) => {
    try {
        const schema = z.object({
            prefix: z.string().min(2).max(30).regex(/^[a-z0-9_-]+$/),
            name: z.string().min(1),
            adminUsername: z.string().min(3).optional().or(z.literal("")),
            adminPassword: z.string().min(6).optional().or(z.literal("")),
        }).refine((data) => {
            return (!data.adminUsername && !data.adminPassword) || (!!data.adminUsername && !!data.adminPassword);
        }, {
            message: "ADMIN_USERNAME_AND_PASSWORD_REQUIRED_TOGETHER",
            path: ["adminUsername"],
        });

        const { prefix, name, adminUsername, adminPassword } = schema.parse(req.body);

        const existing = await prisma.network.findUnique({ where: { prefix } });
        if (existing) {
            return res.status(400).json({ ok: false, error: "PREFIX_EXISTS" });
        }

        if (adminUsername) {
            const existingUser = await prisma.user.findUnique({ where: { email: adminUsername } });
            if (existingUser) {
                return res.status(400).json({ ok: false, error: "ADMIN_USERNAME_EXISTS" });
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            const network = await tx.network.create({
                data: { prefix, name },
            });

            let adminUser = null;
            if (adminUsername && adminPassword) {
                adminUser = await tx.user.create({
                    data: {
                        email: adminUsername,
                        passwordHash: await hashPassword(adminPassword),
                        displayName: `${name} Admin`,
                        role: "NETWORK_ADMIN",
                        networkId: network.id,
                    },
                    select: { id: true, email: true, displayName: true, role: true },
                });
            }

            return { network, adminUser };
        });

        return res.status(201).json({
            ok: true,
            data: {
                ...result.network,
                adminUser: result.adminUser,
                tenantUrl: `https://${prefix}.${process.env.BASE_DOMAIN || "tmw-monitors.com"}`,
            },
        });
    } catch (err) {
        next(err);
    }
});

// Update network
router.put("/:id", async (req, res, next) => {
    try {
        const schema = z.object({
            name: z.string().min(1).optional(),
            logoUrl: z.string().optional(),
            isActive: z.boolean().optional(),
            // Real-time settings
            realtimeEnabled: z.boolean().optional(),
            checkIntervalMs: z.number().min(1000).max(300000).optional(),
            featureWebhookEnabled: z.boolean().optional(),
            featureAutoWithdraw: z.boolean().optional(),
            // Telegram settings
            telegramBotToken: z.string().optional(),
            telegramChatId: z.string().optional(),
            telegramEnabled: z.boolean().optional(),
            notifyMoneyIn: z.boolean().optional(),
            notifyMoneyOut: z.boolean().optional(),
            notifyMinAmount: z.number().min(0).optional(),
            expiredAt: z.union([z.string(), z.null()]).optional(),
            // Bank account settings
            bankName: z.string().optional(),
            bankAccountNumber: z.string().optional(),
            bankAccountName: z.string().optional(),
        });

        const data = schema.parse(req.body);

        // Clean empty strings to null for optional fields
        const cleanData = {
            ...data,
            logoUrl: data.logoUrl === "" ? null : data.logoUrl,
            telegramBotToken: data.telegramBotToken === "" ? null : data.telegramBotToken,
            telegramChatId: data.telegramChatId === "" ? null : data.telegramChatId,
            expiredAt: data.expiredAt ? new Date(data.expiredAt) : (data.expiredAt === null ? null : undefined),
        };

        const network = await prisma.network.update({
            where: { id: req.params.id as string },
            data: cleanData,
        });

        return res.json({ ok: true, data: network });
    } catch (err) {
        next(err);
    }
});

// Test Telegram notification
router.post("/:id/test-telegram", async (req, res, next) => {
    try {
        const network = await prisma.network.findUnique({
            where: { id: req.params.id as string },
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "NOT_FOUND" });
        }

        if (!network.telegramBotToken || !network.telegramChatId) {
            return res.status(400).json({ ok: false, error: "TELEGRAM_NOT_CONFIGURED" });
        }

        // Send test message
        const message = `🔔 ทดสอบการแจ้งเตือน

📍 เครือข่าย: ${network.name}
🔖 Prefix: ${network.prefix}
⏰ เวลา: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}

✅ การเชื่อมต่อ Telegram สำเร็จ!`;

        const telegramUrl = `https://api.telegram.org/bot${network.telegramBotToken}/sendMessage`;
        const response = await fetch(telegramUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: network.telegramChatId,
                text: message,
                parse_mode: "HTML",
            }),
        });

        const result = await response.json();

        if (result.ok) {
            return res.json({ ok: true, message: "Message sent" });
        } else {
            return res.status(400).json({ ok: false, error: result.description || "TELEGRAM_ERROR" });
        }
    } catch (err) {
        next(err);
    }
});

// Archive network. Data remains available for recovery and audit.
router.delete("/:id", async (req, res, next) => {
    try {
        const network = await prisma.network.update({
            where: { id: req.params.id as string },
            data: { isActive: false, realtimeEnabled: false },
            select: { id: true, prefix: true, name: true },
        });
        logEvent("warn", "network_archived", {
            actorUserId: req.user?.userId,
            networkId: network.id,
            prefix: network.prefix,
        });
        return res.json({ ok: true, data: { ...network, archived: true } });
    } catch (err) {
        res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
});

export default router;

