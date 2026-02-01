import { Router } from "express";
import { prisma } from "../../lib/prisma";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router({ mergeParams: true });

// Configure Multer for disk storage
const uploadDir = path.join(process.cwd(), "public/uploads/slips");

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `slip-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error("Only images are allowed!"));
    }
});

// Upload Slip & Create Request
// Expected body: packageId, amount (will be verified against package price ideally, but user input for now)
router.post("/upload", upload.single("slip"), async (req: any, res: any, next: any) => {
    try {
        if (!req.file) {
            return res.status(400).json({ ok: false, error: "NO_FILE_UPLOADED" });
        }

        const { packageId } = req.body;
        const prefix = req.params.prefix;

        if (!packageId) {
            return res.status(400).json({ ok: false, error: "MISSING_PACKAGE_ID" });
        }

        // Find network
        const network = await prisma.network.findUnique({
            where: { prefix },
            select: { id: true }
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        // Verify package and get price
        const pkg = await (prisma as any).package.findUnique({
            where: { id: packageId }
        });

        if (!pkg) {
            return res.status(404).json({ ok: false, error: "PACKAGE_NOT_FOUND" });
        }

        const slipUrl = `/uploads/slips/${req.file.filename}`;

        const request = await (prisma as any).paymentRequest.create({
            data: {
                networkId: network.id,
                packageId: pkg.id,
                amount: pkg.price,
                slipUrl: slipUrl,
                status: "PENDING"
            }
        });

        return res.status(201).json({ ok: true, data: request });
    } catch (err) {
        next(err);
    }
});

// Get Payment History
router.get("/history", async (req, res, next) => {
    try {
        const prefix = req.params.prefix;

        const network = await prisma.network.findUnique({
            where: { prefix },
            select: { id: true }
        });

        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        const requests = await (prisma as any).paymentRequest.findMany({
            where: { networkId: network.id },
            include: { package: { select: { name: true, durationDays: true } } },
            orderBy: { createdAt: "desc" }
        });

        return res.json({ ok: true, data: requests });
    } catch (err) {
        next(err);
    }
});

export default router;
