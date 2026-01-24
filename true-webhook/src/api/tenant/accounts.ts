import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireNetworkAccess } from "../../middleware/auth";
import { broadcastBalanceUpdate } from "../sse";

const router = Router({ mergeParams: true });

router.use(requireAuth, requireNetworkAccess);

// Get network from prefix
async function getNetwork(prefix: string) {
    return prisma.network.findUnique({ where: { prefix } });
}

// List accounts
router.get("/", async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const network = await getNetwork(req.params.prefix);
        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        const accounts = await prisma.account.findMany({
            where: { networkId: network.id },
            orderBy: { createdAt: "desc" },
            include: { telegramConfig: true },
        });

        return res.json({ ok: true, data: accounts });
    } catch (err) {
        next(err);
    }
});

// Get GLOBAL history (All accounts)
router.get("/all-history", async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const network = await getNetwork(req.params.prefix);
        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        const limit = parseInt(req.query.limit as string, 10) || 20;
        const page = parseInt(req.query.page as string, 10) || 1;
        const skip = (page - 1) * limit;

        // Date Filtering
        const fromDate = req.query.from ? new Date(req.query.from as string) : null;
        const toDate = req.query.to ? new Date(req.query.to as string) : null;

        const dateFilterTx: any = {};
        const dateFilterSnap: any = {};

        if (fromDate || toDate) {
            dateFilterTx.timestamp = {};
            dateFilterSnap.checkedAt = {};
            if (fromDate) {
                dateFilterTx.timestamp.gte = fromDate;
                dateFilterSnap.checkedAt.gte = fromDate;
            }
            if (toDate) {
                dateFilterTx.timestamp.lte = toDate;
                dateFilterSnap.checkedAt.lte = toDate;
            }
        }

        // Fetch all accounts
        const accounts = await prisma.account.findMany({
            where: { networkId: network.id },
            select: { id: true, name: true, phoneNumber: true }
        });
        const accountIds = accounts.map(a => a.id);
        const accountMap = accounts.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {} as any);

        // 1. Get Totals
        const [totalTx, totalSnaps] = await Promise.all([
            (prisma as any).financialTransaction.count({
                where: {
                    accountId: { in: accountIds },
                    ...dateFilterTx
                }
            }),
            prisma.balanceSnapshot.count({
                where: {
                    accountId: { in: accountIds },
                    ...dateFilterSnap
                }
            })
        ]);
        const total = totalTx + totalSnaps;

        // 2. Fetch Data
        const [transactions, snapshots] = await Promise.all([
            (prisma as any).financialTransaction.findMany({
                where: {
                    accountId: { in: accountIds },
                    ...dateFilterTx
                },
                orderBy: { timestamp: "desc" },
                skip: skip,
                take: limit,
            }),
            prisma.balanceSnapshot.findMany({
                where: {
                    accountId: { in: accountIds },
                    ...dateFilterSnap
                },
                orderBy: { checkedAt: "desc" },
                skip: skip,
                take: limit,
            })
        ]);

        // Map Transactions
        const txHistory = transactions.map((tx: any) => ({
            id: tx.id,
            type: "transaction",
            amount: tx.amount,
            fee: tx.fee,
            direction: tx.type,
            sender: tx.senderMobile || tx.senderName || "Unknown",
            recipient: tx.recipientMobile || tx.recipientName || "Unknown",
            status: tx.status,
            checkedAt: tx.timestamp,
            change: tx.type === 'outgoing' ? -tx.amount : tx.amount,
            changeSatang: (tx.type === 'outgoing' ? -tx.amount : tx.amount) * 100,
            accountName: accountMap[tx.accountId]?.name || "Unknown",
            accountId: tx.accountId
        }));

        // Map Snapshots
        const snapshotHistory = snapshots.map((snapshot: any) => {
            return {
                id: snapshot.id,
                type: "snapshot",
                balance: snapshot.balanceSatang / 100,
                balanceSatang: snapshot.balanceSatang,
                change: 0,
                changeSatang: 0,
                mobileNo: snapshot.mobileNo,
                source: snapshot.source,
                checkedAt: snapshot.checkedAt,
                accountName: accountMap[snapshot.accountId]?.name || "Unknown",
                accountId: snapshot.accountId
            };
        });

        // Merge and Sort
        const mergedHistory = [...txHistory, ...snapshotHistory]
            .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())
            .slice(0, limit);

        return res.json({
            ok: true,
            data: mergedHistory,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (err) {
        next(err);
    }
});

// Create account
router.post("/", async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const network = await getNetwork(req.params.prefix);
        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        const schema = z.object({
            name: z.string().min(1),
            phoneNumber: z.string().optional(),
            walletEndpointUrl: z.string().url(),
            walletBearerToken: z.string().min(1),
        });

        const data = schema.parse(req.body);

        const account = await prisma.account.create({
            data: { ...data, networkId: network.id },
        });

        return res.status(201).json({ ok: true, data: account });
    } catch (err) {
        next(err);
    }
});

// Update account
router.put("/:id", async (req: Request<{ prefix: string; id: string }>, res: Response, next: NextFunction) => {
    try {
        const schema = z.object({
            name: z.string().optional(),
            phoneNumber: z.string().optional(),
            walletEndpointUrl: z.string().url().optional(),
            walletBearerToken: z.string().min(1).optional(),
            isActive: z.boolean().optional(),
        });

        const data = schema.parse(req.body);

        const account = await prisma.account.update({
            where: { id: req.params.id },
            data,
        });

        return res.json({ ok: true, data: account });
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ ok: false, error: "Validation Error: " + err.errors.map((e: any) => e.message).join(", ") });
        }
        console.error("Update wallet error:", err);
        return res.status(500).json({ ok: false, error: err.message || "Failed to update wallet" });
    }
});

// Delete account
router.delete("/:id", async (req: Request<{ prefix: string; id: string }>, res: Response, next: NextFunction) => {
    try {
        await prisma.account.delete({ where: { id: req.params.id } });
        return res.status(204).send();
    } catch (err) {
        res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
});

// Check balance from external wallet API
router.post("/:id/balance", async (req: Request<{ prefix: string; id: string }>, res: Response, next: NextFunction) => {
    try {
        const account = await prisma.account.findUnique({
            where: { id: req.params.id },
        });

        if (!account) {
            return res.status(404).json({ ok: false, error: "ACCOUNT_NOT_FOUND" });
        }

        // Fetch balance from external wallet API
        try {
            const walletRes = await fetch(account.walletEndpointUrl, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${account.walletBearerToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!walletRes.ok) {
                return res.status(502).json({ ok: false, error: "WALLET_API_ERROR", status: walletRes.status });
            }

            const walletData = await walletRes.json();

            // Parse balance from API response
            // Format: { status: "ok", data: { balance: "20010", mobile_no: "0801234567", updated_at: "..." } }
            let balanceSatang = 0;
            let mobileNo = account.phoneNumber || "";

            if (walletData.data) {
                // Balance is a string in satang
                balanceSatang = parseInt(walletData.data.balance, 10) || 0;
                mobileNo = walletData.data.mobile_no || account.phoneNumber || "";
            } else if (walletData.balance) {
                // Fallback format
                balanceSatang = parseInt(walletData.balance, 10) || 0;
                mobileNo = walletData.mobile_no || walletData.mobileNo || account.phoneNumber || "";
            }

            // Check if balance changed from last snapshot
            const lastSnapshot = await prisma.balanceSnapshot.findFirst({
                where: { accountId: account.id },
                orderBy: { checkedAt: "desc" },
            });

            const balanceChanged = !lastSnapshot || lastSnapshot.balanceSatang !== balanceSatang;

            // Only save snapshot if balance changed
            let checkedAt = new Date();
            if (balanceChanged) {
                const snapshot = await prisma.balanceSnapshot.create({
                    data: {
                        accountId: account.id,
                        balanceSatang: balanceSatang,
                        mobileNo: mobileNo,
                        source: "manual_check",
                        walletUpdatedAt: new Date(),
                    },
                });
                checkedAt = snapshot.checkedAt;
            } else {
                // Use last snapshot time if no change
                checkedAt = lastSnapshot?.checkedAt || new Date();
            }

            // Broadcast update via SSE
            const change = balanceSatang - (lastSnapshot?.balanceSatang || 0);
            broadcastBalanceUpdate(account.id, {
                balance: balanceSatang / 100,
                balanceSatang: balanceSatang,
                change: change,
                checkedAt: checkedAt,
            });

            return res.json({
                ok: true,
                data: {
                    balance: balanceSatang / 100, // Convert satang to baht
                    balanceSatang,
                    mobileNo,
                    checkedAt,
                    changed: balanceChanged,
                },
            });
        } catch (fetchErr) {
            console.error("Wallet API fetch error:", fetchErr);
            return res.status(502).json({ ok: false, error: "WALLET_API_UNREACHABLE" });
        }
    } catch (err) {
        next(err);
    }
});

// Get latest balance for an account
router.get("/:id/balance", async (req: Request<{ prefix: string; id: string }>, res: Response, next: NextFunction) => {
    try {
        const snapshot = await prisma.balanceSnapshot.findFirst({
            where: { accountId: req.params.id },
            orderBy: { checkedAt: "desc" },
        });

        if (!snapshot) {
            return res.json({ ok: true, data: null });
        }

        return res.json({
            ok: true,
            data: {
                balance: snapshot.balanceSatang / 100,
                balanceSatang: snapshot.balanceSatang,
                mobileNo: snapshot.mobileNo,
                checkedAt: snapshot.checkedAt,
            },
        });
    } catch (err) {
        next(err);
    }
});

// Get balance history for an account (timeline)
router.get("/:id/history", async (req: Request<{ prefix: string; id: string }>, res: Response, next: NextFunction) => {
    try {
        const limit = parseInt(req.query.limit as string, 10) || 50;
        const page = parseInt(req.query.page as string, 10) || 1;
        const skip = (page - 1) * limit;

        // Date Filtering
        const fromDate = req.query.from ? new Date(req.query.from as string) : null;
        const toDate = req.query.to ? new Date(req.query.to as string) : null;

        const dateFilterTx: any = {};
        const dateFilterSnap: any = {};

        if (fromDate || toDate) {
            dateFilterTx.timestamp = {};
            dateFilterSnap.checkedAt = {};
            if (fromDate) {
                dateFilterTx.timestamp.gte = fromDate;
                dateFilterSnap.checkedAt.gte = fromDate;
            }
            if (toDate) {
                dateFilterTx.timestamp.lte = toDate;
                dateFilterSnap.checkedAt.lte = toDate;
            }
        }

        // 1. Get Totals
        const [totalTx, totalSnaps] = await Promise.all([
            (prisma as any).financialTransaction.count({
                where: { accountId: req.params.id, ...dateFilterTx }
            }),
            prisma.balanceSnapshot.count({
                where: { accountId: req.params.id, ...dateFilterSnap }
            })
        ]);
        const total = totalTx + totalSnaps;

        // Fetch both Transactions (New) and Snapshots (Old)
        const [transactions, snapshots] = await Promise.all([
            (prisma as any).financialTransaction.findMany({
                where: { accountId: req.params.id, ...dateFilterTx },
                orderBy: { timestamp: "desc" },
                skip: skip,
                take: limit,
            }),
            prisma.balanceSnapshot.findMany({
                where: { accountId: req.params.id, ...dateFilterSnap },
                orderBy: { checkedAt: "desc" },
                skip: skip,
                take: limit,
            })
        ]);

        // Map Transactions to unified format
        const txHistory = transactions.map((tx: any) => ({
            id: tx.id,
            type: "transaction",
            amount: tx.amount, // Net change magnitude
            fee: tx.fee,
            direction: tx.type, // "incoming" or "outgoing"
            sender: tx.senderMobile || tx.senderName || "Unknown",
            recipient: tx.recipientMobile || tx.recipientName || "Unknown",
            status: tx.status,
            checkedAt: tx.timestamp, // Use timestamp as sort key
            // Derived fields for frontend compatibility
            balance: 0, // We don't track running balance in transactions yet
            change: tx.type === 'outgoing' ? -tx.amount : tx.amount,
            changeSatang: (tx.type === 'outgoing' ? -tx.amount : tx.amount) * 100,
        }));

        // Map Snapshots to unified format
        const snapshotHistory = snapshots.map((snapshot: any, index: number) => {
            const prevSnapshot = snapshots[index + 1];
            const change = prevSnapshot ? snapshot.balanceSatang - prevSnapshot.balanceSatang : 0;
            return {
                id: snapshot.id,
                type: "snapshot",
                balance: snapshot.balanceSatang / 100,
                balanceSatang: snapshot.balanceSatang,
                change: change / 100,
                changeSatang: change,
                mobileNo: snapshot.mobileNo,
                source: snapshot.source,
                checkedAt: snapshot.checkedAt,
            };
        });

        // Merge and Sort
        const mergedHistory = [...txHistory, ...snapshotHistory]
            .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())
            .slice(0, limit);

        return res.json({
            ok: true,
            data: mergedHistory,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (err) {
        next(err);
    }
});

export default router;


