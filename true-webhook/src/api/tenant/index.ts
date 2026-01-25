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

                // If still no account, use the first account in the network (assume single-account network)
                if (!accountId && accounts.length > 0) {
                    accountId = accounts[0].id;
                }

                if (!accountId) {
                    errors.push(`Log ${log.id}: No account found`);
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

// Debug: Check which transactions are missing
router.get("/debug-missing", async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const network = await prisma.network.findUnique({
            where: { prefix: req.params.prefix },
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        const accounts = await prisma.account.findMany({
            where: { networkId: network.id },
            select: { id: true, phoneNumber: true }
        });

        // Get all decoded payload logs from today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const logs = await prisma.notificationLog.findMany({
            where: {
                message: { contains: "Decoded Payload" },
                createdAt: { gte: startOfDay },
            },
            orderBy: { createdAt: "desc" },
            take: 50
        });

        // Get existing transactions
        const existingTxs = await prisma.financialTransaction.findMany({
            where: {
                accountId: { in: accounts.map(a => a.id) },
                timestamp: { gte: startOfDay }
            },
            select: { transactionId: true, amount: true, timestamp: true }
        });

        const existingIds = new Set(existingTxs.map(t => t.transactionId));

        const analysis = logs.map(log => {
            const payload = log.payload as any;
            if (!payload) return { id: log.id, status: "NO_PAYLOAD" };

            const txId = payload.transaction_id ||
                (payload.event_type === 'FEE_PAYMENT' ? `fee-${payload.iat}-${payload.amount}` : null) ||
                payload.ref_id ||
                `recovered-${log.id}`;

            const exists = existingIds.has(String(txId));
            const amount = payload.amount ? payload.amount / 100 : 0;

            return {
                logId: log.id,
                time: log.createdAt,
                eventType: payload.event_type,
                amount: amount,
                txId: txId,
                exists: exists,
                status: exists ? "ALREADY_EXISTS" : "MISSING"
            };
        });

        const missing = analysis.filter(a => a.status === "MISSING");
        const existing = analysis.filter(a => a.status === "ALREADY_EXISTS");

        return res.json({
            ok: true,
            data: {
                totalLogs: logs.length,
                missing: missing.length,
                existing: existing.length,
                missingDetails: missing.slice(0, 20),
                existingDetails: existing.slice(0, 5)
            }
        });
    } catch (err) {
        next(err);
    }
});

// Fix misassigned transactions
router.post("/fix-transactions", async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const network = await prisma.network.findUnique({
            where: { prefix: req.params.prefix },
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        // Get accounts
        const accounts = await prisma.account.findMany({
            where: { networkId: network.id },
            select: { id: true, name: true, phoneNumber: true }
        });

        // Map phone numbers to account IDs (last 9 digits)
        const phoneToAccountId = new Map<string, string>();
        accounts.forEach(a => {
            if (a.phoneNumber) {
                phoneToAccountId.set(a.phoneNumber.slice(-9), a.id);
                phoneToAccountId.set(a.phoneNumber, a.id);
            }
        });

        // Get wrong account ID (อรปภา = 0957831757)
        const wrongAccountId = accounts.find(a => a.phoneNumber?.includes("957831757"))?.id;
        // Get correct account ID (โสวัฒน์ = 0985082838)
        const correctAccountId = accounts.find(a => a.phoneNumber?.includes("985082838"))?.id;

        if (!wrongAccountId || !correctAccountId) {
            return res.status(400).json({ ok: false, error: "Could not find accounts" });
        }

        // Start from 18:18 today (when authorization issues started)
        const startTime = new Date();
        startTime.setHours(18, 18, 0, 0);

        // Delete wrongly assigned transactions
        const deleted = await prisma.financialTransaction.deleteMany({
            where: {
                accountId: wrongAccountId,
                timestamp: { gte: startTime },
                transactionId: { startsWith: "recovered-" }
            }
        });

        // Now get notification logs from 18:18 onwards
        const logs = await prisma.notificationLog.findMany({
            where: {
                message: { contains: "Decoded Payload" },
                createdAt: { gte: startTime },
            },
            orderBy: { createdAt: "asc" }
        });

        let recovered = 0;
        let skipped = 0;

        for (const log of logs) {
            try {
                const payload = log.payload as any;
                if (!payload || !payload.amount) continue;

                // Determine correct account from log message (e.g., "Decoded Payload for jga88")
                // For now, we'll use the mobile number in the message if available
                // Or match based on the log's accountId if it was set
                let accountId = log.accountId;

                // If log message contains specific mobile number, use that
                const logMessage = log.message || "";
                for (const [phone, id] of phoneToAccountId.entries()) {
                    if (logMessage.includes(phone.slice(-4))) {
                        accountId = id;
                        break;
                    }
                }

                // Check payload mobiles
                if (!accountId) {
                    const mobiles = [payload.recipient_mobile, payload.sender_mobile, payload.mobile_no].filter(Boolean);
                    for (const mobile of mobiles) {
                        const key = mobile.slice(-9);
                        if (phoneToAccountId.has(key)) {
                            accountId = phoneToAccountId.get(key)!;
                            break;
                        }
                    }
                }

                // Default to correct account for this network's main wallet
                if (!accountId) {
                    accountId = correctAccountId;
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

                // Parse amount
                let amount = payload.amount || 0;
                let fee = payload.fee || 0;
                if (amount > 0) amount = amount / 100.0;
                if (fee > 0) fee = fee / 100.0;
                if (payload.event_type === "FEE_PAYMENT") fee = amount;

                let txType = "incoming";
                if (payload.event_type === "FEE_PAYMENT" || payload.event_type === "SEND_P2P") {
                    txType = "outgoing";
                }

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
                        recipientMobile: payload.recipient_mobile,
                        recipientName: payload.event_type === 'FEE_PAYMENT' ? 'System Fee' : payload.recipient_name,
                        rawPayload: payload,
                        timestamp: log.createdAt,
                    }
                });

                recovered++;
            } catch (err: any) {
                // Skip individual errors
            }
        }

        return res.json({
            ok: true,
            data: {
                deleted: deleted.count,
                recovered,
                skipped,
                correctAccountId,
                wrongAccountId
            }
        });
    } catch (err) {
        next(err);
    }
});

// Force recover all transactions from 18:18 using log ID as unique key
router.post("/force-recover", async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const network = await prisma.network.findUnique({
            where: { prefix: req.params.prefix },
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        const accounts = await prisma.account.findMany({
            where: { networkId: network.id },
            select: { id: true, name: true, phoneNumber: true }
        });

        // Target account (โสวัฒน์ = 0985082838)
        const targetAccountId = accounts.find(a => a.phoneNumber?.includes("985082838"))?.id;
        if (!targetAccountId) {
            return res.status(400).json({ ok: false, error: "Target account not found" });
        }

        // Start from 18:18 today
        const startTime = new Date();
        startTime.setHours(18, 18, 0, 0);

        // Get all logs from 18:18 onwards
        const logs = await prisma.notificationLog.findMany({
            where: {
                message: { contains: "Decoded Payload" },
                createdAt: { gte: startTime },
            },
            orderBy: { createdAt: "asc" }
        });

        let recovered = 0;
        let skipped = 0;
        const details: any[] = [];

        for (const log of logs) {
            try {
                const payload = log.payload as any;
                if (!payload || !payload.amount) {
                    skipped++;
                    continue;
                }

                // Use log ID as unique transaction ID to avoid duplicates
                const transactionId = `log-${log.id}`;

                // Check if already exists
                const exists = await prisma.financialTransaction.findUnique({
                    where: { transactionId: transactionId }
                });

                if (exists) {
                    skipped++;
                    continue;
                }

                // Parse amount (satang to baht)
                let amount = payload.amount || 0;
                if (amount > 0) amount = amount / 100.0;

                let txType = "incoming";
                if (payload.event_type === "FEE_PAYMENT" || payload.event_type === "SEND_P2P") {
                    txType = "outgoing";
                }

                await prisma.financialTransaction.create({
                    data: {
                        transactionId: transactionId,
                        accountId: targetAccountId,
                        amount: amount,
                        fee: payload.event_type === "FEE_PAYMENT" ? amount : 0,
                        type: txType,
                        status: payload.status || "SUCCESS",
                        senderMobile: payload.sender_mobile,
                        senderName: payload.sender_name,
                        recipientMobile: payload.recipient_mobile,
                        recipientName: payload.event_type === 'FEE_PAYMENT' ? 'System Fee' : payload.recipient_name,
                        rawPayload: payload,
                        timestamp: new Date(payload.transaction_date || log.createdAt),
                    }
                });

                recovered++;
                details.push({
                    time: payload.transaction_date,
                    amount: amount,
                    type: payload.event_type
                });
            } catch (err: any) {
                details.push({ error: err.message, logId: log.id });
            }
        }

        return res.json({
            ok: true,
            data: {
                totalLogs: logs.length,
                recovered,
                skipped,
                targetAccountId,
                details: details.slice(0, 20)
            }
        });
    } catch (err) {
        next(err);
    }
});

// Move transactions from อรปภา to โสวัฒน์
router.post("/move-transactions", async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const network = await prisma.network.findUnique({
            where: { prefix: req.params.prefix },
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        const accounts = await prisma.account.findMany({
            where: { networkId: network.id },
            select: { id: true, name: true, phoneNumber: true }
        });

        // Source: อรปภา (0957831757)
        const sourceAccountId = accounts.find(a => a.phoneNumber?.includes("957831757"))?.id;
        // Target: โสวัฒน์ (0985082838)
        const targetAccountId = accounts.find(a => a.phoneNumber?.includes("985082838"))?.id;

        if (!sourceAccountId || !targetAccountId) {
            return res.status(400).json({ ok: false, error: "Accounts not found" });
        }

        // Start from 18:27 today (earliest in user's list)
        const startTime = new Date();
        startTime.setHours(18, 27, 0, 0);

        // Get transactions to move
        const transactionsToMove = await prisma.financialTransaction.findMany({
            where: {
                accountId: sourceAccountId,
                timestamp: { gte: startTime },
                type: "outgoing" // Only fees/withdrawals
            },
            select: { id: true, amount: true, timestamp: true, transactionId: true }
        });

        // Check which already exist in target account (by amount and timestamp)
        const existingInTarget = await prisma.financialTransaction.findMany({
            where: {
                accountId: targetAccountId,
                timestamp: { gte: startTime }
            },
            select: { amount: true, timestamp: true }
        });

        // Create a set of existing keys
        const existingKeys = new Set(
            existingInTarget.map(t => `${t.amount}-${t.timestamp.getTime()}`)
        );

        // Filter out duplicates
        const toMove = transactionsToMove.filter(t =>
            !existingKeys.has(`${t.amount}-${t.timestamp.getTime()}`)
        );

        // Move transactions by updating accountId
        let moved = 0;
        for (const tx of toMove) {
            await prisma.financialTransaction.update({
                where: { id: tx.id },
                data: { accountId: targetAccountId }
            });
            moved++;
        }

        // Delete duplicates that remain in source
        const duplicates = transactionsToMove.filter(t =>
            existingKeys.has(`${t.amount}-${t.timestamp.getTime()}`)
        );

        for (const tx of duplicates) {
            await prisma.financialTransaction.delete({
                where: { id: tx.id }
            });
        }

        return res.json({
            ok: true,
            data: {
                sourceAccount: "อรปภา",
                targetAccount: "โสวัฒน์",
                totalFound: transactionsToMove.length,
                moved: moved,
                deletedDuplicates: duplicates.length
            }
        });
    } catch (err) {
        next(err);
    }
});

export default router;
