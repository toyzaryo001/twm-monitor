import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { deleteFromCloudinary, uploadToCloudinary } from "../../lib/cloudinary";
import multer from "multer";
import { createRateLimit } from "../../middleware/rateLimit";

const router = Router({ mergeParams: true });
const uploadRateLimit = createRateLimit({ name: "payment_upload", windowMs: 10 * 60 * 1000, max: 10 });

function isSupportedImage(buffer: Buffer) {
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    const isWebp = buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP";
    return isJpeg || isPng || isWebp;
}

// Configure Multer for memory storage (for Cloudinary upload)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype) {
            return cb(null, true);
        }
        cb(new Error("Only images are allowed!"));
    }
});

// Upload Slip & Create Request (uses Cloudinary)
router.post("/upload", uploadRateLimit, upload.single("slip"), async (req: any, res: any, next: any) => {
    try {
        if (!req.file) {
            return res.status(400).json({ ok: false, error: "NO_FILE_UPLOADED" });
        }
        if (!isSupportedImage(req.file.buffer)) {
            return res.status(400).json({ ok: false, error: "INVALID_IMAGE_CONTENT" });
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

        if (!pkg || !pkg.isActive) {
            return res.status(404).json({ ok: false, error: "PACKAGE_NOT_FOUND" });
        }

        // Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(req.file.buffer, `slips/${prefix}`);
        const slipUrl = uploadResult.url;

        let request;
        try {
            request = await (prisma as any).paymentRequest.create({
                data: {
                    networkId: network.id,
                    packageId: pkg.id,
                    amount: pkg.price,
                    slipUrl: slipUrl,
                    status: "PENDING"
                }
            });
        } catch (err) {
            await deleteFromCloudinary(uploadResult.publicId).catch(() => undefined);
            throw err;
        }

        return res.status(201).json({ ok: true, data: request });
    } catch (err) {
        console.error("Upload error:", err);
        next(err);
    }
});

// Get Payment History
router.get("/history", async (req: any, res, next) => {
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
