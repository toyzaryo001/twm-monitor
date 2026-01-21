import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireNetworkAccess } from "../../middleware/auth";

const router = Router({ mergeParams: true });

router.use(requireAuth, requireNetworkAccess);

// Get network from prefix
async function getNetwork(prefix: string) {
    return prisma.network.findUnique({ where: { prefix } });
}

// List accounts
router.get("/", async (req, res, next) => {
    try {
        const network = await getNetwork(req.params.prefix as string);
        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        const accounts = await prisma.account.findMany({
            where: { networkId: network.id },
            orderBy: { createdAt: "desc" },
            include: { telegramConfig: true },
        });

        return res.json({ ok: true, data: accounts });
    } catch (err) {
        next(err);
    }
});

// Create account
router.post("/", async (req, res, next) => {
    try {
        const network = await getNetwork(req.params.prefix as string);
        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }

        const schema = z.object({
            name: z.string().min(1),
            phoneNumber: z.string().optional(),
            walletEndpointUrl: z.string().url(),
            walletBearerToken: z.string().min(1),
        });

        const data = schema.parse(req.body);

        const account = await prisma.account.create({
            data: { ...data, networkId: network.id },
        });

        return res.status(201).json({ ok: true, data: account });
    } catch (err) {
        next(err);
    }
});

// Update account
router.put("/:id", async (req, res, next) => {
    try {
        const schema = z.object({
            name: z.string().optional(),
            phoneNumber: z.string().optional(),
            walletEndpointUrl: z.string().url().optional(),
            walletBearerToken: z.string().min(1).optional(),
            isActive: z.boolean().optional(),
        });

        const data = schema.parse(req.body);

        const account = await prisma.account.update({
            where: { id: req.params.id as string },
            data,
        });

        return res.json({ ok: true, data: account });
    } catch (err) {
        next(err);
    }
});

// Delete account
router.delete("/:id", async (req, res, next) => {
    try {
        await prisma.account.delete({ where: { id: req.params.id as string } });
        return res.status(204).send();
    } catch (err) {
        res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
});

export default router;
