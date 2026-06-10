
import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { broadcastBalanceUpdate } from "../sse";
import { logEvent, sanitizeLogPayload } from "../../lib/logging";

const router = Router({ mergeParams: true });

// TrueMoney Webhook Payload Schema
const numberLikeSchema = z.number().or(z.string());
const optionalNumberLikeSchema = numberLikeSchema.nullish();

const webhookSchema = z.object({
    transaction_id: z.string().optional(),
    amount: optionalNumberLikeSchema,
    amount_net: optionalNumberLikeSchema,
    mobile_no: z.string().optional(), // Sender or Recipient mobile (depends on direction)
    recipient_mobile: z.string().optional(),
    sender_mobile: z.string().optional(),
    fee: optionalNumberLikeSchema,
    transaction_fee: optionalNumberLikeSchema,
    transaction_date: z.string().optional(),
    status: z.string().optional(),
    transaction_type: z.string().optional(), // 'creditor' (income) or 'debtor' (expense)
    event_type: z.string().optional(),
    iat: numberLikeSchema.optional(),
    ref_id: z.string().optional(),
    sender_name: z.string().optional(),
    recipient_name: z.string().optional(),
    merchant_name: z.string().optional(),
    server: z.string().optional(),
}).passthrough().refine((data) => {
    return data.server === "handshake" ||
        data.amount != null ||
        data.amount_net != null ||
        Boolean(data.transaction_id) ||
        Boolean(data.ref_id) ||
        Boolean(data.event_type);
}, { message: "INVALID_WEBHOOK_PAYLOAD" });

async function writeWebhookDebugLog(message: string, payload: Record<string, unknown>, accountId?: string) {
    try {
        await prisma.notificationLog.create({
            data: {
                type: "webhook_debug" as any,
                message,
                accountId,
                payload: sanitizeLogPayload(payload) as any,
            }
        });
    } catch (err) {
        logEvent("warn", "webhook_debug_log_failed", {
            message,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

function getBodyShape(body: unknown) {
    if (typeof body === "string") {
        const trimmed = body.trim();
        return {
            kind: "string",
            length: trimmed.length,
            looksJson: trimmed.startsWith("{"),
            looksJwt: trimmed.split(".").length === 3,
        };
    }

    if (body && typeof body === "object") {
        const keys = Object.keys(body as Record<string, unknown>).slice(0, 20);
        return {
            kind: Array.isArray(body) ? "array" : "object",
            keys,
            hasMessage: typeof (body as any).message === "string",
            messageLooksJwt: typeof (body as any).message === "string" &&
                (body as any).message.split(".").length === 3,
        };
    }

    return { kind: typeof body };
}

// POST /api/webhook/:prefix
router.all("/:prefix", async (req: Request, res: Response) => {
    logEvent("info", "webhook_request", { method: req.method, prefix: req.params.prefix });

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
            logEvent("info", "webhook_history_disabled", { prefix });
        }

        await writeWebhookDebugLog(`Webhook POST received for ${prefix}`, {
            prefix,
            method: req.method,
            contentType: req.headers["content-type"] || null,
            userAgent: req.headers["user-agent"] || null,
            queryMobile: req.query.mobile || null,
            hasAuthorization: Boolean(req.headers.authorization),
            authorizationFormat: req.headers.authorization
                ? (String(req.headers.authorization).match(/^Bearer\s+/i) ? "bearer" : "raw")
                : "missing",
            bodyShape: getBodyShape(req.body),
        });

        // 2. Parse Payload
        let payload: any = req.body;

        if (typeof payload === "string") {
            const rawPayload = payload.trim();
            try {
                payload = rawPayload.startsWith("{") ? JSON.parse(rawPayload) : { message: rawPayload };
            } catch {
                payload = { message: rawPayload };
            }
        }

        // Check if payload is wrapped in JWT "message" field
        if (payload.message && typeof payload.message === 'string') {
            try {
                // Initial JWT decode (header.body.signature)
                const parts = payload.message.split('.');
                if (parts.length === 3) {
                    const buffer = Buffer.from(parts[1], 'base64');
                    const decodedStr = buffer.toString('utf-8');
                    payload = JSON.parse(decodedStr);
                    logEvent("info", "webhook_jwt_decoded", { prefix, payload: sanitizeLogPayload(payload) });

                    // Log decoded structure
                    await prisma.notificationLog.create({
                        data: {
                            type: "webhook_debug" as any,
                            message: `Decoded Payload for ${prefix}`,
                            payload: sanitizeLogPayload(payload) as any,
                        }
                    });
                }
            } catch (err) {
                logEvent("warn", "webhook_jwt_decode_failed", { prefix, error: err instanceof Error ? err.message : String(err) });
                await writeWebhookDebugLog(`Webhook JWT decode failed for ${prefix}`, {
                    prefix,
                    error: err instanceof Error ? err.message : String(err),
                    contentType: req.headers["content-type"] || null,
                    queryMobile: req.query.mobile || null,
                    bodyShape: getBodyShape(req.body),
                });
            }
        } else {
            logEvent("debug", "webhook_plain_json_received", { prefix, payload: sanitizeLogPayload(req.body) });
        }

        const parsedPayload = webhookSchema.safeParse(payload);
        if (!parsedPayload.success) {
            logEvent("warn", "webhook_invalid_payload", {
                prefix,
                issues: parsedPayload.error.issues.map((issue) => issue.message),
                payload: sanitizeLogPayload(payload),
            });
            await writeWebhookDebugLog(`Webhook invalid payload for ${prefix}`, {
                prefix,
                issues: parsedPayload.error.issues.map((issue) => ({
                    path: issue.path.join("."),
                    message: issue.message,
                })),
                contentType: req.headers["content-type"] || null,
                queryMobile: req.query.mobile || null,
                bodyShape: getBodyShape(req.body),
                payload,
            });
            return res.status(400).json({ error: "Invalid webhook payload" });
        }
        payload = parsedPayload.data;

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
            logEvent("warn", "webhook_missing_mobile", { prefix, payload: sanitizeLogPayload(payload) });
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
                logEvent("info", "webhook_single_account_fallback", {
                    prefix,
                    accountId: account.id,
                    phoneNumber: account.phoneNumber,
                });

                // If type wasn't determined by direction matching, rely on payload type (already set)
            }
        }

        if (!account) {
            await prisma.notificationLog.create({
                data: {
                    type: "webhook_debug" as any,
                    message: "Account NOT found",
                    payload: sanitizeLogPayload({
                        reason: "No matching mobile in payload or query params",
                        mobiles: [payload.recipient_mobile, payload.sender_mobile, payload.mobile_no, req.query.mobile]
                    }) as any
                }
            });
            logEvent("warn", "webhook_account_not_found", {
                prefix,
                mobiles: sanitizeLogPayload([payload.recipient_mobile, payload.sender_mobile, payload.mobile_no, req.query.mobile]),
            });
            return res.status(200).json({ status: "ignored", reason: "Account not found" });
        }

        // Enforce webhook authorization only for accounts that explicitly set a secret.
        if ((account as any).webhookSecret) {
            const authHeader = req.headers.authorization || "";
            const token = authHeader.replace(/^Bearer\s+/i, "").trim(); // Remove Bearer if present

            if (!token) {
                await writeWebhookDebugLog(`Webhook missing Authorization accepted for ${prefix}`, {
                    prefix,
                    accountId: account.id,
                    transactionId,
                    eventType: payload.event_type || null,
                    queryMobile: req.query.mobile || null,
                    reason: "Provider did not send Authorization header; accepted because account was matched by webhook URL/mobile.",
                }, (account as any).id);
            } else if (token !== (account as any).webhookSecret) {
                logEvent("warn", "webhook_unauthorized", {
                    prefix,
                    accountId: account.id,
                    provided: sanitizeLogPayload({ authorization: authHeader, token }),
                });

                await prisma.notificationLog.create({
                    data: {
                        type: "webhook_debug" as any,
                        message: "Unauthorized Webhook Access",
                        accountId: (account as any).id,
                        payload: sanitizeLogPayload({
                            expected: "***",
                            got_full: authHeader,
                            got_parsed: token
                        }) as any
                    }
                });
                return res.status(401).json({ error: "Unauthorized: Invalid Webhook Secret" });
            }
        }
        // 4. Save Transaction (only if feature is enabled)
        const amount = typeof amountRaw === 'string' ? parseFloat(amountRaw) : amountRaw;
        const fee = typeof feeRaw === 'string' ? parseFloat(feeRaw) : feeRaw;

        // Skip saving transaction if fee recording is disabled
        if (!shouldSaveToHistory) {
            logEvent("info", "webhook_save_skipped_feature_disabled", {
                prefix,
                accountId: account.id,
                transactionId,
            });
            return res.status(200).json({
                status: "ok",
                message: "Data received but not saved (fee recording disabled)",
                featureEnabled: false
            });
        }

        logEvent("info", "webhook_transaction_saving", {
            prefix,
            accountId: account.id,
            transactionId,
            amount,
            fee,
        });

        // Check if transaction already exists (idempotency)
        const existingTx = await prisma.financialTransaction.findUnique({
            where: { transactionId: String(transactionId) }
        });

        if (existingTx) {
            logEvent("info", "webhook_duplicate_transaction", { prefix, accountId: account.id, transactionId });
            return res.status(200).json({ status: "ok", message: "Transaction already processed" });
        }

        try {
            await prisma.financialTransaction.create({
                data: {
                    transactionId: String(transactionId),
                    accountId: (account as any).id,
                    amount: amount,
                    fee: fee,
                    type: determinedType,
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
                    payload: { transactionId, amount, fee, type: determinedType } as any
                }
            });
            logEvent("info", "webhook_transaction_saved", { prefix, accountId: account.id, transactionId });
        } catch (saveErr: any) {
            logEvent("error", "webhook_db_save_failed", {
                prefix,
                accountId: account.id,
                transactionId,
                error: saveErr?.message || String(saveErr),
            });

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
                type: determinedType
            }
        });

        return res.status(200).json({ status: "ok" });

    } catch (error) {
        logEvent("error", "webhook_processing_failed", { prefix, error: error instanceof Error ? error.message : String(error) });
        return res.status(500).json({ error: "Internal processing error" });
    }
});

export default router;
