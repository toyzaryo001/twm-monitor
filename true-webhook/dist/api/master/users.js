"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const auth_1 = require("../../lib/auth");
const auth_2 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_2.requireAuth, auth_2.requireMaster);
// List all users
router.get("/", async (req, res, next) => {
    try {
        const users = await prisma_1.prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            include: { network: { select: { id: true, name: true, prefix: true } } },
            omit: { passwordHash: true, refreshToken: true },
        });
        return res.json({ ok: true, data: users });
    }
    catch (err) {
        next(err);
    }
});
// Create user
router.post("/", async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            email: zod_1.z.string().email(),
            password: zod_1.z.string().min(6),
            displayName: zod_1.z.string().optional(),
            role: zod_1.z.enum(["MASTER", "NETWORK_ADMIN", "NETWORK_USER"]),
            networkId: zod_1.z.string().optional(),
        });
        const { email, password, displayName, role, networkId } = schema.parse(req.body);
        const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(400).json({ ok: false, error: "EMAIL_EXISTS" });
        }
        const passwordHash = await (0, auth_1.hashPassword)(password);
        const user = await prisma_1.prisma.user.create({
            data: { email, passwordHash, displayName, role, networkId },
            include: { network: { select: { id: true, name: true } } },
            omit: { passwordHash: true, refreshToken: true },
        });
        return res.status(201).json({ ok: true, data: user });
    }
    catch (err) {
        next(err);
    }
});
// Update user
router.put("/:id", async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            displayName: zod_1.z.string().optional(),
            role: zod_1.z.enum(["MASTER", "NETWORK_ADMIN", "NETWORK_USER"]).optional(),
            networkId: zod_1.z.string().nullable().optional(),
            password: zod_1.z.string().min(6).optional(),
        });
        const data = schema.parse(req.body);
        const updateData = { ...data };
        if (data.password) {
            updateData.passwordHash = await (0, auth_1.hashPassword)(data.password);
            delete updateData.password;
        }
        const user = await prisma_1.prisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            omit: { passwordHash: true, refreshToken: true },
        });
        return res.json({ ok: true, data: user });
    }
    catch (err) {
        next(err);
    }
});
// Delete user
router.delete("/:id", async (req, res, next) => {
    try {
        await prisma_1.prisma.user.delete({ where: { id: req.params.id } });
        return res.status(204).send();
    }
    catch (err) {
        res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
});
exports.default = router;
