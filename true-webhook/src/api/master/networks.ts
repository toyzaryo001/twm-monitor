import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireMaster } from "../../middleware/auth";

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
        });

        const { prefix, name } = schema.parse(req.body);

        const existing = await prisma.network.findUnique({ where: { prefix } });
        if (existing) {
            return res.status(400).json({ ok: false, error: "PREFIX_EXISTS" });
        }

        const network = await prisma.network.create({
            data: { prefix, name },
        });

        return res.status(201).json({ ok: true, data: network });
    } catch (err) {
        next(err);
    }
});

// Update network
router.put("/:id", async (req, res, next) => {
    try {
        const schema = z.object({
            name: z.string().min(1).optional(),
            isActive: z.boolean().optional(),
            // Real-time settings
            realtimeEnabled: z.boolean().optional(),
            checkIntervalMs: z.number().min(1000).max(300000).optional(),
            // Telegram settings
            telegramBotToken: z.string().optional(),
            telegramChatId: z.string().optional(),
            telegramEnabled: z.boolean().optional(),
            notifyMoneyIn: z.boolean().optional(),
            notifyMoneyOut: z.boolean().optional(),
            notifyMinAmount: z.number().min(0).optional(),
        });

        const data = schema.parse(req.body);

        // Clean empty strings to null for telegram fields
        const cleanData = {
            ...data,
            telegramBotToken: data.telegramBotToken === "" ? null : data.telegramBotToken,
            telegramChatId: data.telegramChatId === "" ? null : data.telegramChatId,
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

// Delete network
router.delete("/:id", async (req, res, next) => {
    try {
        await prisma.network.delete({ where: { id: req.params.id as string } });
        return res.status(204).send();
    } catch (err) {
        res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
});

export default router;

