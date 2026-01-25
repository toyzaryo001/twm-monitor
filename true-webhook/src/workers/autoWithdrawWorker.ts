import { prisma } from "../lib/prisma";
import { executeTransfer } from "../lib/trueMoneyP2P";

let isRunning = false;

export function startAutoWithdrawWorker() {
    console.log("[AutoWithdraw] Worker started (Node.js mode)");
    setInterval(runAutoWithdrawCycle, 60 * 1000); // Check every 1 minute
}

async function runAutoWithdrawCycle() {
    if (isRunning) return;
    isRunning = true;

    try {
        // 1. Find all enabled configs where Network also allows it
        const configs = await prisma.autoWithdrawConfig.findMany({
            where: {
                enabled: true,
                account: {
                    isActive: true,
                    // Check if Network has feature enabled
                    network: {
                        isActive: true,
                        featureAutoWithdraw: true
                    }
                }
            },
            include: {
                account: {
                    include: {
                        // Get latest balance snapshot
                        balanceSnapshots: {
                            orderBy: { checkedAt: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        });

        console.log(`[AutoWithdraw] Checking ${configs.length} accounts...`);

        for (const config of configs) {
            await processAccount(config);
        }

    } catch (e) {
        console.error("[AutoWithdraw] Cycle Error:", e);
    } finally {
        isRunning = false;
    }
}

async function processAccount(config: any) {
    const account = config.account;
    const latestSnapshot = account.balanceSnapshots[0];

    // If no balance data, skip
    if (!latestSnapshot) return;

    const currentBalance = latestSnapshot.balanceSatang / 100;

    // Check Trigger
    if (currentBalance < config.triggerMinBalance) {
        return; // Not enough balance
    }

    // Calculate Withdraw Amount
    let withdrawAmount = 0;

    if (config.withdrawType === 'ALL_EXCEPT') {
        withdrawAmount = currentBalance - config.amountValue;
    } else if (config.withdrawType === 'FIXED_AMOUNT') {
        withdrawAmount = config.amountValue;
    } else {
        // Default fallback: Withdraw all except 0
        withdrawAmount = currentBalance;
    }

    // Sanity check
    if (withdrawAmount <= 0) return;
    if (withdrawAmount > currentBalance) withdrawAmount = currentBalance; // Cap at max

    console.log(`[AutoWithdraw] ID:${account.id} Bal:${currentBalance} -> Withdrawing ${withdrawAmount} to ${config.targetNumber}`);

    try {
        // Execute P2P Transfer using Node.js library
        const result = await executeTransfer(
            account.walletBearerToken,
            config.targetNumber,
            withdrawAmount
        );

        // Log result
        await prisma.notificationLog.create({
            data: {
                type: 'system',
                accountId: account.id,
                message: result.ok
                    ? `Auto-Withdraw Success: ${withdrawAmount} THB to ${config.targetNumber}`
                    : `Auto-Withdraw Failed: ${result.error || result.step || 'Unknown'}`,
                payload: result as any
            }
        });

        // Log to AutoWithdrawLog
        await prisma.autoWithdrawLog.create({
            data: {
                accountId: account.id,
                amount: withdrawAmount,
                targetNumber: config.targetNumber,
                status: result.ok ? 'SUCCESS' : 'FAILED',
                message: result.ok ? JSON.stringify(result.data) : JSON.stringify(result)
            }
        });

        if (result.ok) {
            console.log(`[AutoWithdraw] SUCCESS: ${withdrawAmount} THB to ${config.targetNumber}`);
        } else {
            console.error(`[AutoWithdraw] FAILED:`, result);
        }

    } catch (e: any) {
        console.error(`[AutoWithdraw] Error account=${account.id}`, e);
        await prisma.notificationLog.create({
            data: {
                type: 'system',
                accountId: account.id,
                message: `Auto-Withdraw System Error`,
                payload: { error: e.message }
            }
        });
    }
}

