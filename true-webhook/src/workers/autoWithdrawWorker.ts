import { prisma } from "../lib/prisma";
import { exec } from "child_process";
import path from "path";
import util from "util";

const execPromise = util.promisify(exec);

let isRunning = false;

export function startAutoWithdrawWorker() {
    console.log("[AutoWithdraw] Worker started");
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

    // EXECUTE PHP SCRIPT
    // Path to php script
    const scriptPath = path.join(process.cwd(), "php-engine", "withdraw.php");
    // Command
    const cmd = `php "${scriptPath}" "${account.walletBearerToken}" "${config.targetNumber}" "${withdrawAmount}"`;

    try {
        const { stdout, stderr } = await execPromise(cmd);

        let result: any = {};
        try {
            result = JSON.parse(stdout);
        } catch (e) {
            result = { ok: false, error: "JSON_PARSE_ERROR", raw: stdout };
        }

        // Log result
        await prisma.notificationLog.create({
            data: {
                type: 'system',
                accountId: account.id,
                message: result.ok ? `Auto-Withdraw Success: ${withdrawAmount} THB` : `Auto-Withdraw Failed: ${result.error || 'Unknown'}`,
                payload: result
            }
        });

        // Also log to AutoWithdrawLog (if table exists)
        /*
        await prisma.autoWithdrawLog.create({
           data: {
               accountId: account.id,
               amount: withdrawAmount,
               targetNumber: config.targetNumber,
               status: result.ok ? 'SUCCESS' : 'FAILED',
               message: JSON.stringify(result)
           }
        });
        */

    } catch (e: any) {
        console.error(`[AutoWithdraw] Exec Error account=${account.id}`, e);
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
