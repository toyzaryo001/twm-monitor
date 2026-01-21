"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)({ mergeParams: true });
router.use(auth_1.requireAuth, auth_1.requireNetworkAccess);
// Get network from prefix
async function getNetwork(prefix) {
    return prisma_1.prisma.network.findUnique({ where: { prefix } });
}
// List accounts
router.get("/", async (req, res, next) => {
    try {
        const network = await getNetwork(req.params.prefix);
        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }
        const accounts = await prisma_1.prisma.account.findMany({
            where: { networkId: network.id },
            orderBy: { createdAt: "desc" },
            include: { telegramConfig: true },
        });
        return res.json({ ok: true, data: accounts });
    }
    catch (err) {
        next(err);
    }
});
// Create account
router.post("/", async (req, res, next) => {
    try {
        const network = await getNetwork(req.params.prefix);
        if (!network) {
            return res.status(404).json({ ok: false, error: "NETWORK_NOT_FOUND" });
        }
        const schema = zod_1.z.object({
            name: zod_1.z.string().min(1),
            phoneNumber: zod_1.z.string().optional(),
            walletEndpointUrl: zod_1.z.string().url(),
            walletBearerToken: zod_1.z.string().min(1),
        });
        const data = schema.parse(req.body);
        const account = await prisma_1.prisma.account.create({
            data: { ...data, networkId: network.id },
        });
        return res.status(201).json({ ok: true, data: account });
    }
    catch (err) {
        next(err);
    }
});
// Update account
router.put("/:id", async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            name: zod_1.z.string().optional(),
            phoneNumber: zod_1.z.string().optional(),
            walletEndpointUrl: zod_1.z.string().url().optional(),
            walletBearerToken: zod_1.z.string().min(1).optional(),
            isActive: zod_1.z.boolean().optional(),
        });
        const data = schema.parse(req.body);
        const account = await prisma_1.prisma.account.update({
            where: { id: req.params.id },
            data,
        });
        return res.json({ ok: true, data: account });
    }
    catch (err) {
        next(err);
    }
});
// Delete account
router.delete("/:id", async (req, res, next) => {
    try {
        await prisma_1.prisma.account.delete({ where: { id: req.params.id } });
        return res.status(204).send();
    }
    catch (err) {
        res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
});
exports.default = router;
