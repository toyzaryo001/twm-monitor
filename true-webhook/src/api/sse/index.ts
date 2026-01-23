import { Router, Request, Response } from "express";
import { prisma } from "../../lib/prisma";

const router = Router();

// Store connected clients per account
const clients = new Map<string, Set<Response>>();

// SSE endpoint for real-time balance updates
router.get("/balance/:accountId", async (req: Request, res: Response) => {
    const { accountId } = req.params;

    // Verify account exists
    const account = await prisma.account.findUnique({
        where: { id: accountId },
    });

    if (!account) {
        return res.status(404).json({ ok: false, error: "ACCOUNT_NOT_FOUND" });
    }

    // Setup SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    // Add client to set
    if (!clients.has(accountId)) {
        clients.set(accountId, new Set());
    }
    clients.get(accountId)!.add(res);

    console.log(`[SSE] Client connected for account ${accountId}. Total: ${clients.get(accountId)!.size}`);

    // Send initial data
    const latestSnapshot = await prisma.balanceSnapshot.findFirst({
        where: { accountId },
        orderBy: { checkedAt: "desc" },
    });

    if (latestSnapshot) {
        res.write(`data: ${JSON.stringify({
            type: "initial",
            balance: latestSnapshot.balanceSatang / 100,
            balanceSatang: latestSnapshot.balanceSatang,
            checkedAt: latestSnapshot.checkedAt,
        })}\n\n`);
    }

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
        res.write(": heartbeat\n\n");
    }, 30000);

    // Cleanup on disconnect
    req.on("close", () => {
        clearInterval(heartbeat);
        clients.get(accountId)?.delete(res);
        console.log(`[SSE] Client disconnected for account ${accountId}. Remaining: ${clients.get(accountId)?.size || 0}`);
    });
});

// Function to broadcast to all connected clients for an account
export function broadcastBalanceUpdate(accountId: string, data: {
    balance: number;
    balanceSatang: number;
    change: number;
    checkedAt: Date;
    transaction?: {
        amount: number;
        fee: number;
        type: string;
    };
}) {
    const accountClients = clients.get(accountId);
    if (!accountClients || accountClients.size === 0) {
        return;
    }

    const message = JSON.stringify({
        type: "update",
        ...data,
    });

    console.log(`[SSE] Broadcasting to ${accountClients.size} clients for account ${accountId}`);

    accountClients.forEach((client) => {
        try {
            client.write(`data: ${message}\n\n`);
        } catch (err) {
            console.error("[SSE] Error sending to client:", err);
            accountClients.delete(client);
        }
    });
}

// Get connected clients count (for debugging)
router.get("/status", (req: Request, res: Response) => {
    const status: Record<string, number> = {};
    clients.forEach((clientSet, accountId) => {
        status[accountId] = clientSet.size;
    });
    res.json({ ok: true, data: { clients: status } });
});

export default router;
