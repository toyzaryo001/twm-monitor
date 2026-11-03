import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma";
import { z } from "zod";
import { requireNetworkAdmin } from "../../middleware/auth";
import { logEvent } from "../../lib/logging";

const router = Router({ mergeParams: true });

const feeEventFilters = () => [
    { recipientName: { equals: "System Fee" } },
    { recipientName: { equals: "P2P Fee" } },
    { recipientMobile: { equals: "System Fee" } },
    { recipientMobile: { equals: "P2P Fee" } },
    { rawPayload: { path: ["event_type"], equals: "FEE_PAYMENT" } },
];

const exactFeeFilters = () => [
    { fee: { gt: 0 } },
    ...feeEventFilters(),
];

// Helper to check network exists
const getNetwork = async (prefix: string) => {
    return prisma.network.findUnique({ where: { prefix } });
};

// GET /api/tenant/:prefix/tuning
// Returns all accounts with current month's fee stats, receive stats, and tuning settings
router.get("/", requireNetworkAdmin, async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const network = await getNetwork(req.params.prefix);
        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        const accounts = await prisma.account.findMany({
            where: { networkId: network.id },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                name: true,
                phoneNumber: true,
                isActive: true,
                createdAt: true,
            }
        });

        const accountIds = accounts.map(a => a.id);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

        // Fetch current month's fee transactions
        const feeTxs = await (prisma as any).financialTransaction.findMany({
            where: {
                accountId: { in: accountIds },
                type: "outgoing",
                timestamp: { gte: startOfMonth },
                OR: exactFeeFilters()
            },
            select: {
                id: true,
                accountId: true,
                amount: true,
                fee: true,
                timestamp: true,
                transactionId: true,
                rawPayload: true,
            },
            orderBy: { timestamp: "desc" }
        });

        // Fetch incoming transactions count for this month
        const incomingCounts = await (prisma as any).financialTransaction.groupBy({
            by: ['accountId'],
            _count: true,
            where: {
                accountId: { in: accountIds },
                type: "incoming",
                timestamp: { gte: startOfMonth }
            }
        });

        // Fetch tuning settings from SystemSetting
        const settingKeys = accountIds.map(id => `tuning:${network.id}:${id}`);
        const settings = await prisma.systemSetting.findMany({
            where: { key: { in: settingKeys } }
        });

        const settingsMap = new Map<string, any>();
        settings.forEach(s => {
            try {
                settingsMap.set(s.key, JSON.parse(s.value));
            } catch {
                settingsMap.set(s.key, null);
            }
        });

        // Fetch recent adjustments history
        const adjustmentTxs = await (prisma as any).financialTransaction.findMany({
            where: {
                accountId: { in: accountIds },
                OR: [
                    { transactionId: { startsWith: "adj-fee-" } },
                    { rawPayload: { path: ["isAdjustment"], equals: true } }
                ]
            },
            take: 20,
            orderBy: { timestamp: "desc" },
            select: {
                id: true,
                accountId: true,
                transactionId: true,
                amount: true,
                fee: true,
                type: true,
                timestamp: true,
                rawPayload: true,
            }
        });

        const data = await Promise.all(accounts.map(async account => {
            const accFeeTxs = feeTxs.filter((t: any) => t.accountId === account.id);
            const totalFee = accFeeTxs.reduce((sum: number, t: any) => sum + (t.fee > 0 ? t.fee : t.amount || 0), 0);

            const incGroup = incomingCounts.find((g: any) => g.accountId === account.id);
            const baseIncomingCount = incGroup ? incGroup._count : 0;

            const tuningKey = `tuning:${network.id}:${account.id}`;
            const tuningConfig = settingsMap.get(tuningKey) || null;

            // Effective receive count: if tuned, calculate targetReceiveCount + any new incoming after tunedAt
            let effectiveReceiveCount = baseIncomingCount;
            if (tuningConfig && tuningConfig.targetReceiveCount != null) {
                const tunedAtDate = tuningConfig.tunedAt ? new Date(tuningConfig.tunedAt) : null;
                if (tunedAtDate) {
                    const newIncomingCount = await (prisma as any).financialTransaction.count({
                        where: {
                            accountId: account.id,
                            type: "incoming",
                            timestamp: { gt: tunedAtDate }
                        }
                    });
                    effectiveReceiveCount = Number(tuningConfig.targetReceiveCount) + newIncomingCount;
                } else {
                    effectiveReceiveCount = Number(tuningConfig.targetReceiveCount);
                }
            }

            // Effective fee count: if tuned, calculate targetFeeCount + any new fee txs after tunedAt
            let effectiveFeeCount = accFeeTxs.length;
            if (tuningConfig && tuningConfig.targetFeeCount != null && tuningConfig.targetFeeCount > 0) {
                const tunedAtDate = tuningConfig.tunedAt ? new Date(tuningConfig.tunedAt) : null;
                if (tunedAtDate) {
                    const newFeeCount = accFeeTxs.filter((t: any) =>
                        !t.transactionId?.startsWith("adj-fee-") &&
                        new Date(t.timestamp) > tunedAtDate
                    ).length;
                    effectiveFeeCount = Number(tuningConfig.targetFeeCount) + newFeeCount;
                } else {
                    effectiveFeeCount = Number(tuningConfig.targetFeeCount);
                }
            }

            const accAdjustments = adjustmentTxs
                .filter((tx: any) => tx.accountId === account.id)
                .map((tx: any) => ({
                    id: tx.id,
                    transactionId: tx.transactionId,
                    amount: tx.fee || tx.amount,
                    type: tx.type,
                    timestamp: tx.timestamp,
                    diffFee: tx.rawPayload?.diffFee ?? tx.amount,
                    note: tx.rawPayload?.note || "ปรับจูนยอดยกมา",
                    tunedBy: tx.rawPayload?.tunedBy || "-",
                    targetFeeAmount: tx.rawPayload?.targetFeeAmount,
                    targetReceiveCount: tx.rawPayload?.targetReceiveCount,
                }));

            return {
                id: account.id,
                name: account.name,
                phoneNumber: account.phoneNumber,
                isActive: account.isActive,
                currentFeeTotal: Math.round(totalFee * 100) / 100,
                currentFeeCount: effectiveFeeCount,
                currentReceiveCount: effectiveReceiveCount,
                tuningConfig,
                adjustments: accAdjustments,
            };
        }));

        return res.json({ ok: true, data });
    } catch (err) {
        next(err);
    }
});

// POST /api/tenant/:prefix/tuning
// Save adjustment and synchronize opening balance with TrueMoney app
router.post("/", requireNetworkAdmin, async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const network = await getNetwork(req.params.prefix);
        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        const schema = z.object({
            accountId: z.string().min(1, "ACCOUNT_ID_REQUIRED"),
            targetFeeAmount: z.number().min(0, "INVALID_FEE_AMOUNT"),
            targetFeeCount: z.number().int().min(0).optional(),
            targetReceiveCount: z.number().int().min(0).optional(),
            note: z.string().optional(),
        });

        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                ok: false,
                error: "ข้อมูลไม่ถูกต้อง: " + parsed.error.issues.map(i => i.message).join(", ")
            });
        }

        const { accountId, targetFeeAmount, targetFeeCount, targetReceiveCount, note } = parsed.data;

        // Verify account belongs to network
        const account = await prisma.account.findFirst({
            where: { id: accountId, networkId: network.id },
            select: { id: true, name: true, phoneNumber: true }
        });

        if (!account) {
            return res.status(404).json({ ok: false, error: "ACCOUNT_NOT_FOUND" });
        }

        // Calculate current month's fee total
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

        const currentFeeTxs = await (prisma as any).financialTransaction.findMany({
            where: {
                accountId: account.id,
                type: "outgoing",
                timestamp: { gte: startOfMonth },
                OR: exactFeeFilters()
            },
            select: { id: true, transactionId: true, amount: true, fee: true }
        });

        // Delete any prior adjustment transactions for this account in the current month so we don't accumulate duplicates
        await (prisma as any).financialTransaction.deleteMany({
            where: {
                accountId: account.id,
                timestamp: { gte: startOfMonth },
                transactionId: { startsWith: "adj-fee-" }
            }
        });

        // Recalculate natural fee total without prior adjustment
        const naturalFeeTxs = currentFeeTxs.filter((t: any) => !t.transactionId?.startsWith("adj-fee-"));
        const naturalFeeTotal = naturalFeeTxs.reduce((sum: number, t: any) => sum + (t.fee > 0 ? t.fee : t.amount || 0), 0);
        const diffFee = Math.round((targetFeeAmount - naturalFeeTotal) * 100) / 100;

        const tunedBy = (req as any).user?.email || "admin";

        // If there's a difference in fee, record an adjustment transaction
        if (Math.abs(diffFee) >= 0.01) {
            const adjTx = await (prisma as any).financialTransaction.create({
                data: {
                    transactionId: `adj-fee-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                    accountId: account.id,
                    amount: diffFee > 0 ? diffFee : 0,
                    fee: diffFee > 0 ? diffFee : 0,
                    type: "outgoing",
                    status: "SUCCESS",
                    senderName: "ระบบปรับจูนยอดยกมา",
                    recipientName: "System Fee",
                    timestamp: new Date(),
                    rawPayload: {
                        event_type: "FEE_PAYMENT",
                        isAdjustment: true,
                        diffFee,
                        targetFeeAmount,
                        targetFeeCount: targetFeeCount ?? null,
                        targetReceiveCount: targetReceiveCount ?? null,
                        note: note || "ปรับจูนยอดยกมาค่าธรรมเนียมให้ตรงกับแอป TrueMoney",
                        tunedBy,
                        naturalFeeTotal,
                        previousFeeTotal: naturalFeeTotal,
                    }
                }
            });

            logEvent("info", "tuning_adjustment_created", {
                prefix: req.params.prefix,
                accountId: account.id,
                transactionId: adjTx.transactionId,
                diffFee,
                targetFeeAmount,
            });
        }

        // Save tuning settings in SystemSetting
        const settingKey = `tuning:${network.id}:${account.id}`;
        const tuningData = {
            accountId: account.id,
            targetFeeAmount,
            targetFeeCount: targetFeeCount ?? 0,
            targetReceiveCount: targetReceiveCount ?? 0,
            lastDiffFee: diffFee,
            note: note || "",
            tunedAt: new Date().toISOString(),
            tunedBy,
            naturalFeeTotal,
            previousFeeTotal: naturalFeeTotal,
        };

        await prisma.systemSetting.upsert({
            where: { key: settingKey },
            update: { value: JSON.stringify(tuningData) },
            create: { key: settingKey, value: JSON.stringify(tuningData) },
        });

        // Audit log in NotificationLog
        await prisma.notificationLog.create({
            data: {
                type: "system",
                message: `ปรับจูนข้อมูลวอลเล็ท ${account.name}: ค่าธรรมเนียม ฿${targetFeeAmount.toLocaleString()} (ส่วนต่าง: ${diffFee >= 0 ? "+" : ""}${diffFee.toFixed(2)} บาท)`,
                accountId: account.id,
                payload: {
                    ...tuningData,
                    diffFee,
                } as any,
            }
        });

        return res.json({
            ok: true,
            message: "บันทึกการปรับจูนเรียบร้อยแล้ว",
            data: {
                tuning: tuningData,
                diffFee,
                newFeeTotal: targetFeeAmount,
            }
        });
    } catch (err) {
        next(err);
    }
});

export default router;
