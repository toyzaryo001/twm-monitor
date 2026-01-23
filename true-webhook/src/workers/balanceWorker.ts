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
    network: {
        telegramEnabled: boolean;
        telegramBotToken: string | null;
        telegramChatId: string | null;
        notifyMoneyIn: boolean;
        notifyMoneyOut: boolean;
        notifyMinAmount: number;
    };
}

// Store last known balance for each account (in memory)
const lastBalances = new Map<string, number>();

// Store network check intervals
const networkIntervals = new Map<string, NodeJS.Timeout>();

// Send Telegram notification
async function sendTelegramNotification(
    account: AccountToCheck,
    changeAmount: number,
    newBalance: number
) {
    const { network } = account;

    if (!network.telegramEnabled || !network.telegramBotToken || !network.telegramChatId) {
        return;
    }

    // Check if should notify based on direction
    const isMoneyIn = changeAmount > 0;
    const isMoneyOut = changeAmount < 0;

    if (isMoneyIn && !network.notifyMoneyIn) return;
    if (isMoneyOut && !network.notifyMoneyOut) return;

    // Check minimum amount
    const absChange = Math.abs(changeAmount);
    if (absChange < network.notifyMinAmount) return;

    // Format message
    const emoji = isMoneyIn ? "💚" : "❤️";
    const direction = isMoneyIn ? "เงินเข้า" : "เงินออก";
    const changeFormatted = (changeAmount / 100).toLocaleString("th-TH", { minimumFractionDigits: 2 });
    const balanceFormatted = (newBalance / 100).toLocaleString("th-TH", { minimumFractionDigits: 2 });

    const message = `${emoji} <b>${direction}</b>

💳 บัญชี: ${account.name}
📱 เบอร์: ${account.phoneNumber || "-"}
💰 จำนวน: <b>${isMoneyIn ? "+" : ""}${changeFormatted} บาท</b>
🏦 ยอดคงเหลือ: ${balanceFormatted} บาท
⏰ เวลา: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`;

    try {
        const telegramUrl = `https://api.telegram.org/bot${network.telegramBotToken}/sendMessage`;
        await fetch(telegramUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: network.telegramChatId,
                text: message,
                parse_mode: "HTML",
            }),
        });
        console.log(`[Worker] Telegram sent for ${account.name}: ${changeFormatted} baht`);
    } catch (err) {
        console.error(`[Worker] Telegram error for ${account.name}:`, err);
    }
}

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

            // Send Telegram notification (only for actual changes, not first check)
            if (lastBalance !== undefined && changeAmount !== 0) {
                sendTelegramNotification(account, changeAmount, balanceSatang);
            }

            console.log(`[Worker] ${account.name}: Balance changed ${(lastBalance || 0) / 100} → ${balanceSatang / 100} (${changeAmount >= 0 ? "+" : ""}${changeAmount / 100})`);
        }

        return { changed, balance: balanceSatang };
    } catch (err) {
        console.error(`[Worker] Error checking ${account.name}:`, err);
        return { changed: false, balance: 0 };
    }
}

// Check accounts for a specific network
async function checkNetworkBalances(networkId: string) {
    const accounts = await prisma.account.findMany({
        where: {
            isActive: true,
            networkId: networkId,
        },
        select: {
            id: true,
            name: true,
            walletEndpointUrl: true,
            walletBearerToken: true,
            phoneNumber: true,
            networkId: true,
            network: {
                select: {
                    telegramEnabled: true,
                    telegramBotToken: true,
                    telegramChatId: true,
                    notifyMoneyIn: true,
                    notifyMoneyOut: true,
                    notifyMinAmount: true,
                },
            },
        },
    });

    // Process accounts in parallel
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

// Start workers for each network
async function startNetworkWorkers() {
    // Clear existing intervals
    networkIntervals.forEach(interval => clearInterval(interval));
    networkIntervals.clear();

    // Get all active networks with realtime enabled
    const networks = await prisma.network.findMany({
        where: {
            isActive: true,
            realtimeEnabled: true,
        },
        select: {
            id: true,
            prefix: true,
            checkIntervalMs: true,
        },
    });

    console.log(`[Worker] Starting workers for ${networks.length} networks...`);

    for (const network of networks) {
        const intervalMs = network.checkIntervalMs || 2000;

        // Start interval for this network
        const intervalId = setInterval(async () => {
            try {
                await checkNetworkBalances(network.id);
            } catch (err) {
                console.error(`[Worker] Error checking network ${network.prefix}:`, err);
            }
        }, intervalMs);

        networkIntervals.set(network.id, intervalId);

        // Run immediately
        checkNetworkBalances(network.id);

        console.log(`[Worker] Started: ${network.prefix} (every ${intervalMs}ms)`);
    }
}

// Refresh workers (call when network settings change)
export async function refreshWorkers() {
    console.log("[Worker] Refreshing network workers...");
    await startNetworkWorkers();
}

// Start the background worker
export async function startBalanceWorker() {
    console.log("[Worker] Starting balance worker...");

    // Initialize from database
    await initializeBalances();

    // Start network workers
    await startNetworkWorkers();

    // Refresh workers every 5 minutes to pick up settings changes
    setInterval(async () => {
        try {
            await startNetworkWorkers();
        } catch (err) {
            console.error("[Worker] Error refreshing workers:", err);
        }
    }, 5 * 60 * 1000);
}

// Stop all workers
export function stopBalanceWorker() {
    networkIntervals.forEach(interval => clearInterval(interval));
    networkIntervals.clear();
    console.log("[Worker] Balance workers stopped");
}

// Check if worker is running
export function isWorkerRunning() {
    return networkIntervals.size > 0;
}
