import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireMaster } from "../../middleware/auth";

const router = Router();

router.use(requireAuth, requireMaster);

// Get all settings and current env vars (only for Master)
router.get("/", async (req, res, next) => {
    try {
        const settings = await prisma.systemSetting.findMany();

        // Convert array to object
        const settingsMap = settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, string>);

        return res.json({
            ok: true,
            data: {
                ...settingsMap,
                // Expose current active env secret to Master Admin only
                currentJwtSecret: process.env.JWT_SECRET || "Not Set",
            }
        });
    } catch (err) {
        next(err);
    }
});

// Update a setting
router.post("/", async (req, res, next) => {
    try {
        const schema = z.object({
            key: z.string().min(1),
            value: z.string().min(1),
        });

        const { key, value } = schema.parse(req.body);

        const setting = await prisma.systemSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });

        return res.json({ ok: true, data: setting });
    } catch (err) {
        next(err);
    }
});

export default router;
