import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma";
import { z } from "zod";
import { validateP2PTransaction } from "../../lib/trueMoneyValidate";
import { logEvent } from "../../lib/logging";
import multer from "multer";
import path from "path";
import fs from "fs";
import { uploadToCloudinary } from "../../lib/cloudinary";

const router = Router({ mergeParams: true });

const slipUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        if (allowedTypes.test(file.mimetype) || file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
            return cb(null, true);
        }
        cb(new Error("รองรับเฉพาะไฟล์รูปภาพสลิป (JPG, PNG, WEBP)"));
    },
});

const verifySlipSchema = z.object({
    accountId: z.string().optional(),
    receiverMobile: z.string().min(4, "เบอร์ผู้รับต้องมีอย่างน้อย 4 หลัก"),
    amount: z.number().positive("ยอดเงินต้องมากกว่า 0"),
    transactionDate: z.string().min(10, "กรุณาระบุวันเวลาทำรายการ (yyyy-mm-dd HH:mm)"),
    transactionId: z.string().optional().nullable(),
    senderMobile: z.string().optional().nullable(),
    slipImageUrl: z.string().optional().nullable(),
    qrPayload: z.string().optional().nullable(),
});

// Upload slip image endpoint
router.post("/upload", slipUpload.single("slip"), async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            return res.status(400).json({ ok: false, error: "NO_FILE_UPLOADED" });
        }

        const prefix = req.params.prefix;
        let imageUrl = "";

        if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
            const uploadResult = await uploadToCloudinary(req.file.buffer, `slips/${prefix}`);
            imageUrl = uploadResult.url;
        } else {
            const slipsDir = path.join(process.cwd(), "uploads", "slips", prefix);
            if (!fs.existsSync(slipsDir)) {
                fs.mkdirSync(slipsDir, { recursive: true });
            }
            const ext = path.extname(req.file.originalname) || ".jpg";
            const filename = `slip-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
            const filepath = path.join(slipsDir, filename);
            fs.writeFileSync(filepath, req.file.buffer);
            imageUrl = `/uploads/slips/${prefix}/${filename}`;
        }

        return res.json({ ok: true, data: { imageUrl } });
    } catch (err) {
        next(err);
    }
});

// Verify slip endpoint (Real vs Fake Focus)
router.post("/verify", async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const network = await prisma.network.findUnique({
            where: { prefix: req.params.prefix },
            select: { id: true, name: true, isActive: true },
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND", message: "ไม่พบข้อมูลเครือข่ายร้านค้านี้" });
        }

        const body = verifySlipSchema.parse(req.body);

        // Normalize inputs
        const cleanReceiver = body.receiverMobile.replace(/\D/g, "");
        const amountSatang = Math.round(body.amount * 100);
        const cleanTxId = body.transactionId ? body.transactionId.trim() : null;
        const cleanSender = body.senderMobile ? body.senderMobile.replace(/\D/g, "") : null;
        const normalizedDate = body.transactionDate.trim();

        // 1. Locate receiving account
        let targetAccount: any = null;

        if (body.accountId) {
            targetAccount = await prisma.account.findFirst({
                where: { id: body.accountId, networkId: network.id },
            });
        }

        if (!targetAccount) {
            const accounts = await prisma.account.findMany({
                where: { networkId: network.id },
            });

            targetAccount = accounts.find(a => {
                const accNum = (a.phoneNumber || "").replace(/\D/g, "");
                if (!accNum) return false;
                if (cleanReceiver.length === 10 && accNum === cleanReceiver) return true;
                if (cleanReceiver.length === 4 && accNum.endsWith(cleanReceiver)) return true;
                return false;
            });
        }

        if (!targetAccount) {
            return res.status(400).json({
                ok: false,
                status: "INVALID",
                message: "ไม่พบวอลเล็ทในระบบที่ตรงกับเบอร์ผู้รับ " + cleanReceiver + " กรุณาตรวจสอบเบอร์ผู้รับหรือเลือกวอลเล็ทให้ถูกต้อง",
            });
        }

        const slipToken = targetAccount.slipVerifyToken;

        if (!slipToken) {
            return res.status(400).json({
                ok: false,
                status: "NO_TOKEN",
                message: `วอลเล็ท "${targetAccount.name}" ยังไม่ได้ผูก Key ตรวจสอบสลิป กรุณาไปที่หน้า จัดการวอลเล็ท > แก้ไข > หัวข้อ ตรวจสอบสลิป เพื่อนำ Bearer Token จากหน้า "ตรวจสอบรายการโอนเงินทรูมันนี่" มาใส่`,
            });
        }

        // 2. Call TrueMoney Validate P2P API v1.6 Directly to check REAL vs FAKE
        const apiResult = await validateP2PTransaction(slipToken, {
            receiver_mobile: cleanReceiver,
            amount: amountSatang,
            transaction_date: normalizedDate,
            transaction_id: cleanTxId || undefined,
            sender_mobile: cleanSender || undefined,
        });

        if (!apiResult.ok) {
            // Explain specifically which part is fake or mismatched
            const failMessage = apiResult.error?.thaiExplanation || "ข้อมูลในสลิปไม่ตรงกับฐานข้อมูล TrueMoney (สลิปปลอม)";

            const logEntry = await (prisma as any).slipVerification.create({
                data: {
                    transactionId: cleanTxId,
                    accountId: targetAccount.id,
                    networkId: network.id,
                    amount: body.amount,
                    amountSatang,
                    receiverMobile: cleanReceiver,
                    senderMobile: cleanSender,
                    transactionDate: normalizedDate,
                    status: "INVALID",
                    resultMessage: failMessage,
                    rawResponse: apiResult.raw || apiResult.error || null,
                    slipImageUrl: body.slipImageUrl || null,
                    qrPayload: body.qrPayload || null,
                    verifiedBy: req.user?.email || "ADMIN",
                },
            });

            return res.status(200).json({
                ok: false,
                status: "INVALID",
                message: failMessage,
                errorDetail: apiResult.error,
                data: logEntry,
            });
        }

        // 3. Cross-Check Live Webhook Stream (Optional confirmation)
        let matchedTx: any = null;
        if (cleanTxId) {
            matchedTx = await (prisma as any).financialTransaction.findFirst({
                where: {
                    accountId: targetAccount.id,
                    transactionId: cleanTxId,
                },
            });
        }

        const successMessage = matchedTx
            ? "✅ สลิปจริง 100% (ผ่านการตรวจสอบจาก TrueMoney และพบยอดเงินเข้าจริงในบัญชี)"
            : "✅ สลิปจริง 100% (ผ่านการตรวจสอบความถูกต้องจาก TrueMoney)";

        // 4. Save Valid Slip to Database
        const savedSlip = await (prisma as any).slipVerification.create({
            data: {
                transactionId: cleanTxId,
                accountId: targetAccount.id,
                networkId: network.id,
                amount: body.amount,
                amountSatang,
                receiverMobile: cleanReceiver,
                senderMobile: cleanSender,
                transactionDate: normalizedDate,
                status: "VALID",
                resultMessage: successMessage,
                rawResponse: apiResult.raw || null,
                slipImageUrl: body.slipImageUrl || null,
                qrPayload: body.qrPayload || null,
                linkedTxId: matchedTx?.id || null,
                verifiedBy: req.user?.email || "ADMIN",
            },
            include: {
                account: {
                    select: { id: true, name: true, phoneNumber: true },
                },
            },
        });

        logEvent("info", "slip_verified_successfully", {
            networkId: network.id,
            accountId: targetAccount.id,
            transactionId: cleanTxId,
            amount: body.amount,
        });

        return res.json({
            ok: true,
            status: "VALID",
            message: successMessage,
            data: savedSlip,
        });
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({
                ok: false,
                status: "BAD_REQUEST",
                message: err.errors.map(e => e.message).join(", "),
            });
        }
        next(err);
    }
});

// Get verification history
router.get("/history", async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const network = await prisma.network.findUnique({
            where: { prefix: req.params.prefix },
            select: { id: true },
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        const limit = Math.min(100, Math.max(5, parseInt(req.query.limit as string, 10) || 20));
        const skip = (page - 1) * limit;

        const statusFilter = typeof req.query.status === "string" && req.query.status ? req.query.status : undefined;
        const accountFilter = typeof req.query.accountId === "string" && req.query.accountId ? req.query.accountId : undefined;
        const search = typeof req.query.q === "string" ? req.query.q.trim() : "";

        const where: any = {
            networkId: network.id,
        };

        if (statusFilter && statusFilter !== "ALL") {
            where.status = statusFilter;
        }
        if (accountFilter && accountFilter !== "ALL") {
            where.accountId = accountFilter;
        }
        if (search) {
            where.OR = [
                { transactionId: { contains: search, mode: "insensitive" } },
                { receiverMobile: { contains: search } },
                { senderMobile: { contains: search } },
            ];
        }

        const [slips, total] = await Promise.all([
            (prisma as any).slipVerification.findMany({
                where,
                orderBy: { verifiedAt: "desc" },
                skip,
                take: limit,
                include: {
                    account: {
                        select: { id: true, name: true, phoneNumber: true },
                    },
                },
            }),
            (prisma as any).slipVerification.count({ where }),
        ]);

        return res.json({
            ok: true,
            data: slips,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        next(err);
    }
});

// Get quick statistics
router.get("/stats", async (req: Request<{ prefix: string }>, res: Response, next: NextFunction) => {
    try {
        const network = await prisma.network.findUnique({
            where: { prefix: req.params.prefix },
            select: { id: true },
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [totalCount, validCount, invalidCount, todayValidAmount] = await Promise.all([
            (prisma as any).slipVerification.count({ where: { networkId: network.id } }),
            (prisma as any).slipVerification.count({ where: { networkId: network.id, status: "VALID" } }),
            (prisma as any).slipVerification.count({ where: { networkId: network.id, status: "INVALID" } }),
            (prisma as any).slipVerification.aggregate({
                where: {
                    networkId: network.id,
                    status: "VALID",
                    verifiedAt: { gte: startOfToday },
                },
                _sum: { amount: true },
            }),
        ]);

        return res.json({
            ok: true,
            data: {
                totalCount,
                validCount,
                invalidCount,
                todayValidAmount: todayValidAmount._sum?.amount || 0,
            },
        });
    } catch (err) {
        next(err);
    }
});

export default router;
