import { prisma } from "../lib/prisma";
import { broadcastBalanceUpdate } from "../api/sse";

const TRUE_MONEY_BALANCE_ENDPOINT = "https://apis.truemoneyservices.com/account/v1/balance";

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
const activeNetworkChecks = new Set<string>();
let refreshInterval: NodeJS.Timeout | null = null;
let refreshInProgress = false;
let workerStartedAt: Date | null = null;
let lastRunAt: Date | null = null;
let lastSuccessfulRunAt: Date | null = null;
let lastWorkerError: string | null = null;
let configuredNetworkCount = 0;
let lastRunSummary: { attempted: number; succeeded: number } | null = null;

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
async function checkAccountBalance(account: AccountToCheck, retryCount = 0): Promise<{ changed: boolean; balance: number; success: boolean }> {
    const MAX_RETRIES = 2;
    const TIMEOUT_MS = 10000; // 10 seconds timeout

    try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const response = await fetch(TRUE_MONEY_BALANCE_ENDPOINT, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${account.walletBearerToken}`,
                    "Content-Type": "application/json",
                    "Connection": "close", // Close connection after request
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.error(`[Worker] API error for ${account.name}: ${response.status}`);
                return { changed: false, balance: 0, success: false };
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

            return { changed, balance: balanceSatang, success: true };
        } catch (fetchErr: any) {
            clearTimeout(timeoutId);

            // Handle timeout
            if (fetchErr.name === 'AbortError') {
                console.error(`[Worker] Timeout for ${account.name} after ${TIMEOUT_MS}ms`);
            } else {
                throw fetchErr; // Re-throw to outer catch for retry logic
            }

            return { changed: false, balance: 0, success: false };
        }
    } catch (err: any) {
        // Retry logic for socket errors
        const isSocketError = err.code === 'UND_ERR_SOCKET' ||
            err.cause?.code === 'UND_ERR_SOCKET' ||
            err.message?.includes('socket') ||
            err.message?.includes('fetch failed');

        if (isSocketError && retryCount < MAX_RETRIES) {
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
            console.log(`[Worker] Socket error for ${account.name}, retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);

            await new Promise(resolve => setTimeout(resolve, delay));
            return checkAccountBalance(account, retryCount + 1);
        }

        console.error(`[Worker] Error checking ${account.name} (after ${retryCount} retries):`, err.message || err);
        return { changed: false, balance: 0, success: false };
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
    let succeeded = 0;
    for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
        const batch = accounts.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(account => checkAccountBalance({
            ...account,
            lastBalance: lastBalances.get(account.id) || null,
        })));
        succeeded += results.filter(result => result.success).length;
    }
    return { attempted: accounts.length, succeeded };
}

async function runNetworkBalanceCheck(networkId: string, prefix: string) {
    if (activeNetworkChecks.has(networkId)) {
        console.warn(`[Worker] Skipping overlapping check for ${prefix}`);
        return;
    }

    activeNetworkChecks.add(networkId);
    lastRunAt = new Date();
    try {
        const summary = await checkNetworkBalances(networkId);
        lastRunSummary = summary;
        if (summary.attempted > 0 && summary.succeeded === 0) {
            throw new Error(`All ${summary.attempted} account checks failed`);
        }
        lastSuccessfulRunAt = new Date();
        lastWorkerError = summary.succeeded < summary.attempted
            ? `${summary.attempted - summary.succeeded} account checks failed`
            : null;
    } catch (err) {
        lastWorkerError = err instanceof Error ? err.message : String(err);
        console.error(`[Worker] Error checking network ${prefix}:`, err);
    } finally {
        activeNetworkChecks.delete(networkId);
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
    configuredNetworkCount = networks.length;

    console.log(`[Worker] Starting workers for ${networks.length} networks...`);

    for (const network of networks) {
        const intervalMs = network.checkIntervalMs || 2000;

        // Start interval for this network
        const intervalId = setInterval(async () => {
            await runNetworkBalanceCheck(network.id, network.prefix);
        }, intervalMs);

        networkIntervals.set(network.id, intervalId);

        // Run immediately
        void runNetworkBalanceCheck(network.id, network.prefix);

        console.log(`[Worker] Started: ${network.prefix} (every ${intervalMs}ms)`);
    }
}

// Refresh workers (call when network settings change)
export async function refreshWorkers() {
    if (refreshInProgress) return;
    refreshInProgress = true;
    console.log("[Worker] Refreshing network workers...");
    try {
        await startNetworkWorkers();
    } finally {
        refreshInProgress = false;
    }
}

// Start the background worker
export async function startBalanceWorker() {
    if (workerStartedAt) {
        console.log("[Worker] Balance worker already started");
        return;
    }

    console.log("[Worker] Starting balance worker...");
    workerStartedAt = new Date();
    try {
        // Initialize from database
        await initializeBalances();

        // Start network workers
        await startNetworkWorkers();

        // Refresh workers every 5 minutes to pick up settings changes
        refreshInterval = setInterval(async () => {
            try {
                await refreshWorkers();
            } catch (err) {
                lastWorkerError = err instanceof Error ? err.message : String(err);
                console.error("[Worker] Error refreshing workers:", err);
            }
        }, 5 * 60 * 1000);
    } catch (err) {
        lastWorkerError = err instanceof Error ? err.message : String(err);
        workerStartedAt = null;
        throw err;
    }
}

// Stop all workers
export function stopBalanceWorker() {
    networkIntervals.forEach(interval => clearInterval(interval));
    networkIntervals.clear();
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
    activeNetworkChecks.clear();
    workerStartedAt = null;
    configuredNetworkCount = 0;
    console.log("[Worker] Balance workers stopped");
}

// Check if worker is running
export function isWorkerRunning() {
    return workerStartedAt !== null && networkIntervals.size > 0;
}

export function getWorkerStatus() {
    return {
        running: isWorkerRunning(),
        configuredNetworks: configuredNetworkCount,
        activeChecks: activeNetworkChecks.size,
        startedAt: workerStartedAt?.toISOString() || null,
        lastRunAt: lastRunAt?.toISOString() || null,
        lastSuccessfulRunAt: lastSuccessfulRunAt?.toISOString() || null,
        lastError: lastWorkerError,
        lastRunSummary,
    };
}
