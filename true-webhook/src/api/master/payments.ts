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
        const newExpiry = await prisma.$transaction(async (tx) => {
            const request = await (tx as any).paymentRequest.findUnique({
                where: { id: req.params.id },
                include: { package: true, network: true }
            });
            if (!request) throw new Error("REQUEST_NOT_FOUND");
            if (request.status !== "PENDING") throw new Error("ALREADY_PROCESSED");

            const now = new Date();
            const currentExpiry = request.network.expiredAt ? new Date(request.network.expiredAt) : now;
            const baseDate = currentExpiry > now ? currentExpiry : now;
            const calculatedExpiry = new Date(baseDate);
            calculatedExpiry.setDate(calculatedExpiry.getDate() + request.package.durationDays);

            const claimed = await (tx as any).paymentRequest.updateMany({
                where: { id: req.params.id, status: "PENDING" },
                data: {
                    status: "APPROVED",
                    reviewedBy: req.user?.userId,
                    updatedAt: now
                }
            });
            if (claimed.count !== 1) throw new Error("ALREADY_PROCESSED");

            await tx.network.update({
                where: { id: request.networkId },
                data: { expiredAt: calculatedExpiry } as any
            });
            return calculatedExpiry;
        });

        return res.json({ ok: true, data: { newExpiredAt: newExpiry } });
    } catch (err) {
        if (err instanceof Error && err.message === "REQUEST_NOT_FOUND") {
            return res.status(404).json({ ok: false, error: err.message });
        }
        if (err instanceof Error && err.message === "ALREADY_PROCESSED") {
            return res.status(409).json({ ok: false, error: err.message });
        }
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

        const updated = await (prisma as any).paymentRequest.updateMany({
            where: { id: req.params.id, status: "PENDING" },
            data: {
                status: "REJECTED",
                reviewedBy: req.user?.userId,
                updatedAt: new Date()
            }
        });
        if (updated.count !== 1) {
            return res.status(409).json({ ok: false, error: "ALREADY_PROCESSED" });
        }

        return res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

export default router;
