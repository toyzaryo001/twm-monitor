import { Router, Request, Response, NextFunction } from "express";
import accountsRouter from "./accounts";
import authRouter from "./auth";
import { requireAuth, requireNetworkAccess } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";

const router = Router({ mergeParams: true });

// Auth routes (no auth required - public endpoints)
router.use("/auth", authRouter);

// Protected routes below
router.use(requireAuth, requireNetworkAccess);

// Accounts management
router.use("/accounts", accountsRouter);

// Dashboard stats
router.get("/stats", async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const network = await prisma.network.findUnique({
            where: { prefix: req.params.prefix },
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        const [accountCount, activeAccounts] = await Promise.all([
            prisma.account.count({ where: { networkId: network.id } }),
            prisma.account.count({ where: { networkId: network.id, isActive: true } }),
        ]);

        return res.json({
            ok: true,
            data: {
                network: {
                    id: network.id,
                    name: network.name,
                    prefix: network.prefix,
                    logoUrl: network.logoUrl,
                    isActive: network.isActive,
                    realtimeEnabled: network.realtimeEnabled,
                    checkIntervalMs: network.checkIntervalMs,
                    telegramEnabled: network.telegramEnabled,
                    telegramBotToken: network.telegramBotToken ? "••••••••" + network.telegramBotToken.slice(-8) : null,
                    telegramChatId: network.telegramChatId,
                    notifyMoneyIn: network.notifyMoneyIn,
                    notifyMoneyOut: network.notifyMoneyOut,
                    notifyMinAmount: network.notifyMinAmount,
                    // Inject Network Specific Settings
                    // @ts-ignore
                    isAutoReceiveEnabled: network.featureWebhookEnabled ?? true,
                    // @ts-ignore
                    featureAutoWithdraw: network.featureAutoWithdraw ?? false
                },
                stats: { total: accountCount, active: activeAccounts },
            },
        });
    } catch (err) {
        next(err);
    }
});

// Recover missed transactions from NotificationLog
router.post("/recover-transactions", async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const network = await prisma.network.findUnique({
            where: { prefix: req.params.prefix },
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        // Get all accounts in this network
        const accounts = await prisma.account.findMany({
            where: { networkId: network.id },
            select: { id: true, phoneNumber: true }
        });
        const accountMap = new Map(accounts.map(a => [a.phoneNumber, a.id]));

        // Find all "Decoded Payload" logs from today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const logs = await prisma.notificationLog.findMany({
            where: {
                message: { contains: "Decoded Payload" },
                createdAt: { gte: startOfDay },
            },
            orderBy: { createdAt: "asc" }
        });

        let recovered = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const log of logs) {
            try {
                const payload = log.payload as any;
                if (!payload || !payload.amount) continue;

                // Find matching account
                let accountId = log.accountId;
                if (!accountId) {
                    // Try to match by mobile number
                    const mobiles = [payload.recipient_mobile, payload.sender_mobile, payload.mobile_no].filter(Boolean);
                    for (const mobile of mobiles) {
                        for (const [phone, id] of accountMap.entries()) {
                            if (phone && mobile && phone.includes(mobile.slice(-9))) {
                                accountId = id;
                                break;
                            }
                        }
                        if (accountId) break;
                    }
                }

                // If still no account and only one account exists, use it
                if (!accountId && accounts.length === 1) {
                    accountId = accounts[0].id;
                }

                if (!accountId) {
                    skipped++;
                    continue;
                }

                // Generate transaction ID
                const transactionId = payload.transaction_id ||
                    (payload.event_type === 'FEE_PAYMENT' ? `fee-${payload.iat}-${payload.amount}` : null) ||
                    payload.ref_id ||
                    `recovered-${log.id}`;

                // Check if already exists
                const exists = await prisma.financialTransaction.findUnique({
                    where: { transactionId: String(transactionId) }
                });

                if (exists) {
                    skipped++;
                    continue;
                }

                // Parse amount (satang to baht)
                let amount = payload.amount || payload.amount_net || 0;
                let fee = payload.fee || payload.transaction_fee || 0;
                if (amount > 0) amount = amount / 100.0;
                if (fee > 0) fee = fee / 100.0;

                if (payload.event_type === "FEE_PAYMENT") {
                    fee = amount;
                }

                // Determine type
                let txType = "incoming";
                if (payload.event_type === "FEE_PAYMENT" || payload.event_type === "SEND_P2P") {
                    txType = "outgoing";
                } else if (payload.transaction_type === "debtor") {
                    txType = "outgoing";
                }

                // Create transaction
                await prisma.financialTransaction.create({
                    data: {
                        transactionId: String(transactionId),
                        accountId: accountId,
                        amount: amount,
                        fee: fee,
                        type: txType,
                        status: payload.status || "SUCCESS",
                        senderMobile: payload.sender_mobile,
                        senderName: payload.sender_name,
                        recipientMobile: payload.recipient_mobile || (payload.event_type === 'SEND_P2P' ? payload.merchant_name : null),
                        recipientName:
                            payload.event_type === 'FEE_PAYMENT' ? 'System Fee' :
                                (payload.recipient_name || (payload.event_type === 'SEND_P2P' ? payload.merchant_name : null)),
                        rawPayload: payload,
                        timestamp: log.createdAt,
                    }
                });

                recovered++;
            } catch (err: any) {
                errors.push(`Log ${log.id}: ${err.message}`);
            }
        }

        return res.json({
            ok: true,
            data: {
                totalLogs: logs.length,
                recovered,
                skipped,
                errors: errors.slice(0, 10) // Limit error messages
            }
        });
    } catch (err) {
        next(err);
    }
});

export default router;
