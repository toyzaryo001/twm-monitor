import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireMaster } from "../../middleware/auth";

const router = Router();

// All routes require Master auth
router.use(requireAuth, requireMaster);

// List all packages
router.get("/", async (req, res, next) => {
    try {
        const packages = await prisma.package.findMany({
            orderBy: { price: "asc" }
        });
        return res.json({ ok: true, data: packages });
    } catch (err) {
        next(err);
    }
});

// Create package
router.post("/", async (req, res, next) => {
    try {
        const schema = z.object({
            name: z.string().min(1),
            price: z.number().min(0),
            durationDays: z.number().min(1),
            description: z.string().optional(),
        });

        const data = schema.parse(req.body);

        const pkg = await prisma.package.create({
            data: {
                ...data,
                isActive: true
            }
        });

        return res.status(201).json({ ok: true, data: pkg });
    } catch (err) {
        next(err);
    }
});

// Update package
router.put("/:id", async (req, res, next) => {
    try {
        const schema = z.object({
            name: z.string().min(1).optional(),
            price: z.number().min(0).optional(),
            durationDays: z.number().min(1).optional(),
            description: z.string().optional(),
            isActive: z.boolean().optional(),
        });

        const data = schema.parse(req.body);

        const pkg = await prisma.package.update({
            where: { id: req.params.id },
            data
        });

        return res.json({ ok: true, data: pkg });
    } catch (err) {
        next(err);
    }
});

// Delete package
router.delete("/:id", async (req, res, next) => {
    try {
        await prisma.package.delete({
            where: { id: req.params.id }
        });
        return res.status(204).send();
    } catch (err) {
        next(err);
    }
});

export default router;
