import { prisma } from "../lib/prisma";
import { broadcastBalanceUpdate } from "../api/sse";

interface AccountToCheck {
    id: string;
    name: string;
    walletEndpointUrl: string;
    walletBearerToken: string;
    phoneNumber: string | null;
    networkId: string;
    lastBalance: number | null;
}

// Store last known balance for each account (in memory)
const lastBalances = new Map<string, number>();

// Check balance for a single account
async function checkAccountBalance(account: AccountToCheck): Promise<{ changed: boolean; balance: number }> {
    try {
        const response = await fetch(account.walletEndpointUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${account.walletBearerToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            console.error(`[Worker] API error for ${account.name}: ${response.status}`);
            return { changed: false, balance: 0 };
        }

        const data = await response.json();

        // Parse balance
        let balanceSatang = 0;
        let mobileNo = account.phoneNumber || "";

        if (data.data) {
            balanceSatang = parseInt(data.data.balance, 10) || 0;
            mobileNo = data.data.mobile_no || account.phoneNumber || "";
        } else if (data.balance) {
            balanceSatang = parseInt(data.balance, 10) || 0;
            mobileNo = data.mobile_no || data.mobileNo || account.phoneNumber || "";
        }

        // Check if balance changed
        const lastBalance = lastBalances.get(account.id);
        const changed = lastBalance === undefined || lastBalance !== balanceSatang;

        if (changed) {
            // Update in-memory cache
            lastBalances.set(account.id, balanceSatang);

            // Save to database
            const snapshot = await prisma.balanceSnapshot.create({
                data: {
                    accountId: account.id,
                    balanceSatang,
                    mobileNo,
                    source: "realtime_worker",
                    walletUpdatedAt: new Date(),
                },
            });

            // Calculate change amount
            const changeAmount = lastBalance !== undefined ? balanceSatang - lastBalance : 0;

            // Broadcast to connected SSE clients
            broadcastBalanceUpdate(account.id, {
                balance: balanceSatang / 100,
                balanceSatang,
                change: changeAmount / 100,
                checkedAt: snapshot.checkedAt,
            });

            console.log(`[Worker] ${account.name}: Balance changed ${(lastBalance || 0) / 100} → ${balanceSatang / 100} (${changeAmount >= 0 ? "+" : ""}${changeAmount / 100})`);
        }

        return { changed, balance: balanceSatang };
    } catch (err) {
        console.error(`[Worker] Error checking ${account.name}:`, err);
        return { changed: false, balance: 0 };
    }
}

// Check all active accounts
async function checkAllBalances() {
    const accounts = await prisma.account.findMany({
        where: { isActive: true },
        select: {
            id: true,
            name: true,
            walletEndpointUrl: true,
            walletBearerToken: true,
            phoneNumber: true,
            networkId: true,
        },
    });

    // Process accounts in parallel but with some concurrency limit
    const BATCH_SIZE = 5;
    for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
        const batch = accounts.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(account => checkAccountBalance({
            ...account,
            lastBalance: lastBalances.get(account.id) || null,
        })));
    }
}

// Initialize balances from database
async function initializeBalances() {
    console.log("[Worker] Initializing balances from database...");

    const accounts = await prisma.account.findMany({
        where: { isActive: true },
        select: { id: true },
    });

    for (const account of accounts) {
        const lastSnapshot = await prisma.balanceSnapshot.findFirst({
            where: { accountId: account.id },
            orderBy: { checkedAt: "desc" },
        });

        if (lastSnapshot) {
            lastBalances.set(account.id, lastSnapshot.balanceSatang);
        }
    }

    console.log(`[Worker] Initialized ${lastBalances.size} balances`);
}

// Interval ID for stopping
let intervalId: NodeJS.Timeout | null = null;

// Start the background worker
export async function startBalanceWorker(intervalMs: number = 2000) {
    console.log(`[Worker] Starting balance worker with ${intervalMs}ms interval...`);

    // Initialize from database
    await initializeBalances();

    // Start checking
    intervalId = setInterval(async () => {
        try {
            await checkAllBalances();
        } catch (err) {
            console.error("[Worker] Error in check cycle:", err);
        }
    }, intervalMs);

    // Run immediately
    checkAllBalances();
}

// Stop the worker
export function stopBalanceWorker() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log("[Worker] Balance worker stopped");
    }
}

// Check if worker is running
export function isWorkerRunning() {
    return intervalId !== null;
}
