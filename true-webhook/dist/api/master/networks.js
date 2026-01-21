"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// All routes require Master auth
router.use(auth_1.requireAuth, auth_1.requireMaster);
// List all networks
router.get("/", async (req, res, next) => {
    try {
        const networks = await prisma_1.prisma.network.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                _count: { select: { users: true, accounts: true } },
            },
        });
        return res.json({ ok: true, data: networks });
    }
    catch (err) {
        next(err);
    }
});
// Get single network
router.get("/:id", async (req, res, next) => {
    try {
        const network = await prisma_1.prisma.network.findUnique({
            where: { id: req.params.id },
            include: {
                users: { select: { id: true, email: true, displayName: true, role: true } },
                _count: { select: { accounts: true } },
            },
        });
        if (!network) {
            return res.status(404).json({ ok: false, error: "NOT_FOUND" });
        }
        return res.json({ ok: true, data: network });
    }
    catch (err) {
        next(err);
    }
});
// Create network
router.post("/", async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            prefix: zod_1.z.string().min(2).max(30).regex(/^[a-z0-9_-]+$/),
            name: zod_1.z.string().min(1),
        });
        const { prefix, name } = schema.parse(req.body);
        const existing = await prisma_1.prisma.network.findUnique({ where: { prefix } });
        if (existing) {
            return res.status(400).json({ ok: false, error: "PREFIX_EXISTS" });
        }
        const network = await prisma_1.prisma.network.create({
            data: { prefix, name },
        });
        return res.status(201).json({ ok: true, data: network });
    }
    catch (err) {
        next(err);
    }
});
// Update network
router.put("/:id", async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            name: zod_1.z.string().min(1).optional(),
            isActive: zod_1.z.boolean().optional(),
        });
        const data = schema.parse(req.body);
        const network = await prisma_1.prisma.network.update({
            where: { id: req.params.id },
            data,
        });
        return res.json({ ok: true, data: network });
    }
    catch (err) {
        next(err);
    }
});
// Delete network
router.delete("/:id", async (req, res, next) => {
    try {
        await prisma_1.prisma.network.delete({ where: { id: req.params.id } });
        return res.status(204).send();
    }
    catch (err) {
        res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
});
exports.default = router;
