
import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { broadcastBalanceUpdate } from "../sse";

const router = Router({ mergeParams: true });

// TrueMoney Webhook Payload Schema
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
        // 1. Find Network and check if webhook feature is enabled
        const network = await prisma.network.findUnique({
            where: { prefix },
            select: { id: true, name: true, isActive: true, featureWebhookEnabled: true }
        });

        if (!network) {
            return res.status(404).json({ error: "Network not found" });
        }

        // Check if network is active
        if (!network.isActive) {
            return res.status(403).json({ error: "Network is disabled", code: "NETWORK_DISABLED" });
        }

        // Store feature flag to control History saving (webhook still receives data)
        const shouldSaveToHistory = network.featureWebhookEnabled;
        if (!shouldSaveToHistory) {
            console.log(`[Webhook] Fee recording disabled for network: ${prefix} - will receive but not save`);
        }

        // 2. Parse Payload
        let payload = req.body;

        // Check if payload is wrapped in JWT "message" field
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
        // TrueMoney sends empty transaction_id for Fee events, so we generate a robust unique fallback
        const transactionId = payload.transaction_id ||
            (payload.event_type === 'FEE_PAYMENT' ? `fee-${payload.iat}-${payload.amount}` : null) ||
            payload.ref_id ||
            `unknown-${Date.now()}`;

        // Amount/Fee is in Satang (Integer), convert to Baht (Float)
        let amountRaw = payload.amount || payload.amount_net || 0;
        let feeRaw = payload.fee || payload.transaction_fee || 0;

        if (amountRaw > 0) amountRaw = amountRaw / 100.0;
        if (feeRaw > 0) feeRaw = feeRaw / 100.0;

        // Fee adjustment logic based on event type
        if (payload.event_type === "FEE_PAYMENT") {
            // For fee payment, the 'amount' in payload IS the fee expense.
            feeRaw = amountRaw;
            // Keep amountRaw same as feeRaw so it shows as a negative change in history
        }

        const mobileNo = payload.mobile_no ||
            payload.recipient_mobile ||
            payload.sender_mobile ||
            (req.query.mobile as string); // Support ?mobile=08x on URL

        let transactionType = payload.transaction_type;
        if (!transactionType) {
            if (payload.event_type === "FEE_PAYMENT" || payload.event_type === "SEND_P2P") {
                transactionType = "outgoing";
            } else {
                transactionType = amountRaw > 0 ? "incoming" : "outgoing";
            }
        }

        if (!mobileNo) {
            console.log(`[Webhook] Missing mobile_no in payload/query. Payload:`, JSON.stringify(payload));
        }

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

        // Fallback to generic mobile_no or query param
        if (!account && mobileNo) {
            account = await prisma.account.findFirst({
                where: {
                    networkId: network.id,
                    phoneNumber: { contains: mobileNo }
                }
            });
        }

        // 3.5 SMART FALLBACK: Single Account Network
        // Some events (like SEND_P2P) do not contain the sender's mobile number.
        // If the network has exactly ONE account, it's safe to assume the event belongs to it.
        if (!account) {
            const accounts = await prisma.account.findMany({
                where: { networkId: network.id },
                select: { id: true, phoneNumber: true, webhookSecret: true } as any, // Lightweight fetch
                take: 2
            });

            if (accounts.length === 1) {
                account = accounts[0];
                console.log(`[Webhook] Account not matched by mobile, but network has single account. Using it: ${account.id} (${account.phoneNumber})`);

                // If type wasn't determined by direction matching, rely on payload type (already set)
            }
        }

        if (!account) {
            await prisma.notificationLog.create({
                data: {
                    type: "webhook_debug" as any,
                    message: "Account NOT found",
                    payload: {
                        reason: "No matching mobile in payload or query params",
                        mobiles: [payload.recipient_mobile, payload.sender_mobile, payload.mobile_no, req.query.mobile]
                    } as any
                }
            });
            console.log(`[Webhook] Account not found. Payload mobiles: ${payload.recipient_mobile}, ${payload.sender_mobile}, ${payload.mobile_no}`);
            return res.status(200).json({ status: "ignored", reason: "Account not found" });
        }

        // [DISABLED] Webhook Authorization Key check - ยกเลิกการใช้งาน
        // ระบบจะรับข้อมูลทั้งหมดโดยไม่ต้องตรวจสอบ Key
        /*
        if ((account as any).webhookSecret) {
            const authHeader = req.headers.authorization || "";
            const token = authHeader.replace(/^Bearer\s+/i, ""); // Remove Bearer if present

            if (token !== (account as any).webhookSecret) {
                console.warn(`[Webhook] Unauthorized access attempt for account ${account.id}.`);
                console.warn(`Expected: ${(account as any).webhookSecret}`);
                console.warn(`Got Header: ${authHeader}`);
                console.warn(`Parsed Token: ${token}`);

                await prisma.notificationLog.create({
                    data: {
                        type: "webhook_debug" as any,
                        message: "Unauthorized Webhook Access",
                        accountId: (account as any).id,
                        payload: {
                            expected: "***",
                            got_full: authHeader,
                            got_parsed: token
                        } as any
                    }
                });
                return res.status(401).json({ error: "Unauthorized: Invalid Webhook Secret" });
            }
        }
        */


        // 4. Save Transaction (only if feature is enabled)
        const amount = typeof amountRaw === 'string' ? parseFloat(amountRaw) : amountRaw;
        const fee = typeof feeRaw === 'string' ? parseFloat(feeRaw) : feeRaw;

        // Skip saving transaction if fee recording is disabled
        if (!shouldSaveToHistory) {
            console.log(`[Webhook] Fee recording disabled - skipping save. TX=${transactionId}, Acc=${account.id}`);
            return res.status(200).json({
                status: "ok",
                message: "Data received but not saved (fee recording disabled)",
                featureEnabled: false
            });
        }

        console.log(`[Webhook] Saving Transaction: ID=${transactionId}, Acc=${account.id}, Amt=${amount}, Fee=${fee}`);

        // Check if transaction already exists (idempotency)
        const existingTx = await prisma.financialTransaction.findUnique({
            where: { transactionId: String(transactionId) }
        });

        if (existingTx) {
            console.log(`[Webhook] Transaction ${transactionId} already exists. Skipping.`);
            return res.status(200).json({ status: "ok", message: "Transaction already processed" });
        }

        try {
            await prisma.financialTransaction.create({
                data: {
                    transactionId: String(transactionId),
                    accountId: (account as any).id,
                    amount: amount,
                    fee: fee,
                    type: transactionType,
                    status: payload.status || "SUCCESS",
                    senderMobile: payload.sender_mobile,
                    senderName: payload.sender_name,
                    recipientMobile: payload.recipient_mobile || (payload.event_type === 'SEND_P2P' ? payload.merchant_name : null),
                    recipientName:
                        payload.event_type === 'FEE_PAYMENT' ? 'System Fee' :
                            (payload.recipient_name || (payload.event_type === 'SEND_P2P' ? payload.merchant_name : null)),
                    rawPayload: payload,
                    timestamp: payload.transaction_date ? new Date(payload.transaction_date) : new Date(),
                }
            });

            await prisma.notificationLog.create({
                data: {
                    type: "webhook_debug" as any,
                    message: "Transaction Saved Successfully",
                    accountId: (account as any).id,
                    payload: { transactionId, amount, fee, type: transactionType } as any
                }
            });
            console.log(`[Webhook] Transaction saved successfully!`);
        } catch (saveErr: any) {
            console.error(`[Webhook] DB Save Failed:`, saveErr);

            await prisma.notificationLog.create({
                data: {
                    type: "webhook_debug" as any,
                    message: "DB Save ERROR",
                    payload: { error: saveErr.message, stack: saveErr.stack } as any
                }
            });
            throw saveErr;
        }

        // 5. Update Balance Snapshot (Optional but recommended for consistency)
        // We can't know the *exact* total balance from just a transaction webhook usually
        // But we can record that a check happened. 
        // Ideally, trigger a balance check job here? 
        // For now, let's trust the webhook implies activity.

        // 6. Broadcast Update
        broadcastBalanceUpdate((account as any).id, {
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
