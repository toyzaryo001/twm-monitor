
import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { broadcastBalanceUpdate } from "../sse";

const router = Router({ mergeParams: true });

// TrueMoney Webhook Payload Schema
// Based on typical webhook payloads (adjust as needed based on actual TrueMoney spec)
const webhookSchema = z.object({
    transaction_id: z.string(),
    amount: z.number().or(z.string()),
    mobile_no: z.string(), // Sender or Recipient mobile (depends on direction)
    fee: z.number().or(z.string()).optional().default(0),
    transaction_date: z.string().optional(),
    status: z.string().optional(),
    transaction_type: z.string().optional(), // 'creditor' (income) or 'debtor' (expense)
    // Add other fields as discovered
}).passthrough();

// POST /api/webhook/:prefix
router.post("/:prefix", async (req: Request, res: Response) => {
    const { prefix } = req.params;

    try {
        // 1. Find Network
        const network = await prisma.network.findUnique({
            where: { prefix },
            select: { id: true, name: true }
        });

        if (!network) {
            return res.status(404).json({ error: "Network not found" });
        }

        // 2. Parse Payload
        // Note: TrueMoney might send different structures, need to log payload to verify
        console.log(`[Webhook] Received for ${prefix}:`, JSON.stringify(req.body));

        // Check if body is valid
        // For now, flexible parsing since actual payload might vary
        const payload = req.body;
        const transactionId = payload.transaction_id || payload.ref_id || payload.id;
        const amountRaw = payload.amount || payload.amount_net || 0;
        const feeRaw = payload.fee || payload.transaction_fee || 0;
        const mobileNo = payload.mobile_no || payload.recipient_mobile || payload.sender_mobile;
        const transactionType = payload.transaction_type || (amountRaw > 0 ? "incoming" : "outgoing");

        if (!mobileNo) {
            return res.status(400).json({ error: "Mobile number missing in payload" });
        }

        // 3. Find Account in Network
        const account = await prisma.account.findFirst({
            where: {
                networkId: network.id,
                // Match phone number (simple string match for now)
                // In production, might need number normalization (e.g. 0xx vs 66xx)
                phoneNumber: { contains: mobileNo }
            }
        });

        if (!account) {
            console.log(`[Webhook] Account not found for mobile: ${mobileNo} in network ${prefix}`);
            // Return 200 OK to acknowledge receipt even if account not found (to satisfy webhook sender)
            return res.status(200).json({ status: "ignored", reason: "Account not found" });
        }

        // 4. Save Transaction
        const amount = typeof amountRaw === 'string' ? parseFloat(amountRaw) : amountRaw;
        const fee = typeof feeRaw === 'string' ? parseFloat(feeRaw) : feeRaw;

        // Check if transaction already exists (idempotency)
        const existingTx = await prisma.transaction.findUnique({
            where: { transactionId: String(transactionId) }
        });

        if (existingTx) {
            return res.status(200).json({ status: "ok", message: "Transaction already processed" });
        }

        await prisma.transaction.create({
            data: {
                transactionId: String(transactionId),
                accountId: account.id,
                amount: amount,
                fee: fee,
                type: transactionType,
                status: payload.status || "SUCCESS",
                senderMobile: payload.sender_mobile,
                senderName: payload.sender_name,
                recipientMobile: payload.recipient_mobile,
                recipientName: payload.recipient_name,
                rawPayload: payload,
                timestamp: payload.transaction_date ? new Date(payload.transaction_date) : new Date(),
            }
        });

        // 5. Update Balance Snapshot (Optional but recommended for consistency)
        // We can't know the *exact* total balance from just a transaction webhook usually
        // But we can record that a check happened. 
        // Ideally, trigger a balance check job here? 
        // For now, let's trust the webhook implies activity.

        // 6. Broadcast Update
        broadcastBalanceUpdate(account.id, {
            balance: 0, // We don't know the new total balance unless we fetch it
            balanceSatang: 0,
            change: amount,
            checkedAt: new Date(),
            // Add transaction info for frontend to display toast
            transaction: {
                amount,
                fee,
                type: transactionType
            }
        });

        return res.status(200).json({ status: "ok" });

    } catch (error) {
        console.error(`[Webhook] Error processing for ${prefix}:`, error);
        return res.status(500).json({ error: "Internal processing error" });
    }
});

export default router;
