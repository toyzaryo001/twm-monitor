import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireMaster } from "../../middleware/auth";

const router = Router();

router.use(requireAuth, requireMaster);

// List payment requests
router.get("/", async (req, res, next) => {
    try {
        const { status } = req.query;

        const requests = await (prisma as any).paymentRequest.findMany({
            where: status ? { status: status as string } : undefined,
            include: {
                network: { select: { prefix: true, name: true, expiredAt: true } },
                package: { select: { name: true, durationDays: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        return res.json({ ok: true, data: requests });
    } catch (err) {
        next(err);
    }
});

// Approve payment (Extend expiration)
router.post("/:id/approve", async (req, res, next) => {
    try {
        const request = await (prisma as any).paymentRequest.findUnique({
            where: { id: req.params.id },
            include: { package: true, network: true }
        });

        if (!request) {
            return res.status(404).json({ ok: false, error: "REQUEST_NOT_FOUND" });
        }

        if (request.status !== "PENDING") {
            return res.status(400).json({ ok: false, error: "ALREADY_PROCESSED" });
        }

        // Calculate new expiration date
        const currentExpiry = request.network.expiredAt ? new Date(request.network.expiredAt) : new Date();
        // If expired, start from now. If active, add to existing expiry.
        const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();

        const newExpiry = new Date(baseDate);
        newExpiry.setDate(newExpiry.getDate() + request.package.durationDays);

        // Transaction: Update Request Status + Update Network Expiry
        await prisma.$transaction([
            (prisma as any).paymentRequest.update({
                where: { id: req.params.id },
                data: {
                    status: "APPROVED",
                    reviewedBy: req.user?.userId,
                    updatedAt: new Date()
                }
            }),
            prisma.network.update({
                where: { id: request.networkId },
                data: { expiredAt: newExpiry } as any // Handle potential type mismatch until codegen
            })
        ]);

        return res.json({ ok: true, data: { newExpiredAt: newExpiry } });
    } catch (err) {
        next(err);
    }
});

// Reject payment
router.post("/:id/reject", async (req, res, next) => {
    try {
        const request = await (prisma as any).paymentRequest.findUnique({
            where: { id: req.params.id }
        });

        if (!request) {
            return res.status(404).json({ ok: false, error: "REQUEST_NOT_FOUND" });
        }

        if (request.status !== "PENDING") {
            return res.status(400).json({ ok: false, error: "ALREADY_PROCESSED" });
        }

        await (prisma as any).paymentRequest.update({
            where: { id: req.params.id },
            data: {
                status: "REJECTED",
                reviewedBy: req.user?.userId,
                updatedAt: new Date()
            }
        });

        return res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

export default router;
