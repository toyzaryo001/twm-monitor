
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
router.all("/:prefix", async (req: Request, res: Response) => {
    console.log(`[Webhook] ${req.method} request for prefix: ${req.params.prefix}`);

    // Handle verification requests (HEAD/GET)
    if (req.method === "HEAD" || req.method === "GET") {
        return res.status(200).json({ status: "ok", message: "Ready to receive webhooks" });
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

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
        // Check if payload is wrapped in JWT "message" field
        let payload = req.body;

        if (req.body.message && typeof req.body.message === 'string') {
            try {
                // Initial JWT decode (header.body.signature)
                const parts = req.body.message.split('.');
                if (parts.length === 3) {
                    const buffer = Buffer.from(parts[1], 'base64');
                    const decodedStr = buffer.toString('utf-8');
                    payload = JSON.parse(decodedStr);
                    console.log(`[Webhook] Decoded JWT for ${prefix}:`, JSON.stringify(payload));

                    // Log decoded structure
                    await prisma.notificationLog.create({
                        data: {
                            type: "webhook_debug" as any,
                            message: `Decoded Payload for ${prefix}`,
                            payload: payload as any,
                        }
                    });
                }
            } catch (err) {
                console.error(`[Webhook] Failed to decode JWT:`, err);
            }
        } else {
            const bodyContent = JSON.stringify(req.body);
            console.log(`[Webhook] Received plain JSON for ${prefix}:`, bodyContent);
        }

        // Handle Handshake
        if (payload.server === "handshake") {
            return res.status(200).json({ status: "ok", message: "Handshake accepted" });
        }

        // Extract fields from mapped payload
        const transactionId = payload.transaction_id ||
            (payload.event_type === 'FEE_PAYMENT' ? `fee-${payload.iat}-${payload.amount}` : null) ||
            payload.ref_id ||
            `unknown-${Date.now()}`;
        // Amount might be in Baht or Satang? TrueMoney typically uses Baht in some APIs, Satang in others.
        // Assuming payload.amount is in Baht based on "545" being likely 5.45 fee? Or 545 baht fee?
        // Wait, "545" for a fee? If transfer is 201 baht. Fee 545 is impossible.
        // Fee 5.45 baht? 545 satang = 5.45 baht.
        // So amount is likely in SATANG? Or 545 is decimal?
        // Let's assume input needs normalization.

        let amountRaw = payload.amount || payload.amount_net || 0;
        let feeRaw = payload.fee || payload.transaction_fee || 0;

        // Amount/Fee is in Satang (Integer), convert to Baht (Float)
        if (amountRaw > 0) amountRaw = amountRaw / 100.0;
        if (feeRaw > 0) feeRaw = feeRaw / 100.0;

        // Fee adjustment logic based on event type
        if (payload.event_type === "FEE_PAYMENT") {
            // For fee payment, the 'amount' in payload IS the fee.
            feeRaw = amountRaw;
            amountRaw = 0;
        }

        const mobileNo = payload.mobile_no || payload.recipient_mobile || payload.sender_mobile;
        const transactionType = payload.transaction_type || (amountRaw > 0 ? "incoming" : "outgoing");

        if (!mobileNo) {
            console.log(`[Webhook] Missing mobile_no in payload. Likely a verification test. Payload:`, JSON.stringify(payload));
            return res.status(200).json({ status: "ignored", message: "Missing mobile_no, assuming verification" });
        }

        // 3. Find Account in Network
        // 3. Find Account in Network
        // Strategy: Check if any of the numbers in payload belong to an account in this network
        let account = null;
        let determinedType = transactionType;

        // Check Recipient (Incoming Money)
        if (payload.recipient_mobile) {
            account = await prisma.account.findFirst({
                where: {
                    networkId: network.id,
                    phoneNumber: { contains: payload.recipient_mobile }
                }
            });
            if (account) determinedType = "incoming";
        }

        // Check Sender (Outgoing Money) - if not found yet
        if (!account && payload.sender_mobile) {
            account = await prisma.account.findFirst({
                where: {
                    networkId: network.id,
                    phoneNumber: { contains: payload.sender_mobile }
                }
            });
            if (account) determinedType = "outgoing";
        }

        // Fallback to generic mobile_no
        if (!account && payload.mobile_no) {
            account = await prisma.account.findFirst({
                where: {
                    networkId: network.id,
                    phoneNumber: { contains: payload.mobile_no }
                }
            });
        }

        // Final Fallback: If no mobile found, but we are in a valid network prefix
        // checking the first account (Useful for FEE_PAYMENT which has no mobile info)
        if (!account && network) {
            console.log(`[Webhook] No mobile match, using default account for network ${prefix}`);
            account = await prisma.account.findFirst({
                where: { networkId: network.id }
            });
        }

        if (!account) {
            console.log(`[Webhook] Account not found. Payload mobiles: ${payload.recipient_mobile}, ${payload.sender_mobile}, ${payload.mobile_no}`);
            return res.status(200).json({ status: "ignored", reason: "Account not found" });
        }

        // 4. Save Transaction
        const amount = typeof amountRaw === 'string' ? parseFloat(amountRaw) : amountRaw;
        const fee = typeof feeRaw === 'string' ? parseFloat(feeRaw) : feeRaw;

        // Check if transaction already exists (idempotency)
        const existingTx = await prisma.financialTransaction.findUnique({
            where: { transactionId: String(transactionId) }
        });

        if (existingTx) {
            return res.status(200).json({ status: "ok", message: "Transaction already processed" });
        }

        await prisma.financialTransaction.create({
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
