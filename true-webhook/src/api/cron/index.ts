import { Router, Request, Response } from "express";
import { prisma } from "../../lib/prisma";

const router = Router();

// Secret key for cron authentication (set in Railway env)
const CRON_SECRET = process.env.CRON_SECRET || "default-cron-secret";

// Middleware to verify cron secret
const verifyCronSecret = (req: Request, res: Response, next: Function) => {
    const authHeader = req.headers.authorization;
    const secret = authHeader?.replace("Bearer ", "") || req.query.secret;

    if (secret !== CRON_SECRET) {
        return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
    next();
};

// Cron endpoint to check all active accounts' balances
router.get("/check-balances", verifyCronSecret, async (req: Request, res: Response) => {
    const startTime = Date.now();
    const results: { accountId: string; name: string; success: boolean; changed: boolean; error?: string }[] = [];

    try {
        // Get all active accounts
        const accounts = await prisma.account.findMany({
            where: { isActive: true },
            include: { network: true },
        });

        console.log(`[CRON] Checking ${accounts.length} active accounts...`);

        for (const account of accounts) {
            try {
                // Fetch balance from wallet API
                const walletRes = await fetch(account.walletEndpointUrl, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${account.walletBearerToken}`,
                        "Content-Type": "application/json",
                    },
                });

                if (!walletRes.ok) {
                    results.push({
                        accountId: account.id,
                        name: account.name,
                        success: false,
                        changed: false,
                        error: `API returned ${walletRes.status}`,
                    });
                    continue;
                }

                const walletData = await walletRes.json();

                // Parse balance
                let balanceSatang = 0;
                let mobileNo = account.phoneNumber || "";

                if (walletData.data) {
                    balanceSatang = parseInt(walletData.data.balance, 10) || 0;
                    mobileNo = walletData.data.mobile_no || account.phoneNumber || "";
                } else if (walletData.balance) {
                    balanceSatang = parseInt(walletData.balance, 10) || 0;
                    mobileNo = walletData.mobile_no || walletData.mobileNo || account.phoneNumber || "";
                }

                // Get last snapshot to compare
                const lastSnapshot = await prisma.balanceSnapshot.findFirst({
                    where: { accountId: account.id },
                    orderBy: { checkedAt: "desc" },
                });

                const balanceChanged = !lastSnapshot || lastSnapshot.balanceSatang !== balanceSatang;

                // Only save if balance changed
                if (balanceChanged) {
                    await prisma.balanceSnapshot.create({
                        data: {
                            accountId: account.id,
                            balanceSatang,
                            mobileNo,
                            source: "cron_check",
                            walletUpdatedAt: new Date(),
                        },
                    });

                    console.log(`[CRON] ${account.name}: Balance changed ${lastSnapshot?.balanceSatang || 0} -> ${balanceSatang}`);
                }

                results.push({
                    accountId: account.id,
                    name: account.name,
                    success: true,
                    changed: balanceChanged,
                });

            } catch (fetchErr) {
                console.error(`[CRON] Error checking ${account.name}:`, fetchErr);
                results.push({
                    accountId: account.id,
                    name: account.name,
                    success: false,
                    changed: false,
                    error: "Fetch error",
                });
            }
        }

        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        const changedCount = results.filter(r => r.changed).length;

        console.log(`[CRON] Completed: ${successCount}/${accounts.length} success, ${changedCount} changed, ${duration}ms`);

        return res.json({
            ok: true,
            data: {
                total: accounts.length,
                success: successCount,
                changed: changedCount,
                duration,
                results,
            },
        });

    } catch (err) {
        console.error("[CRON] Fatal error:", err);
        return res.status(500).json({ ok: false, error: "CRON_ERROR" });
    }
});

export default router;
