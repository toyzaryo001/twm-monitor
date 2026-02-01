import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { z } from "zod";

const router = Router();

// Get bank settings
router.get("/", async (req, res, next) => {
    try {
        const settings = await prisma.systemSetting.findMany({
            where: {
                key: { in: ["bankName", "bankAccountNumber", "bankAccountName"] }
            }
        });

        const data: Record<string, string> = {};
        settings.forEach(s => { data[s.key] = s.value; });

        return res.json({ ok: true, data });
    } catch (err) {
        next(err);
    }
});

// Update bank settings
router.put("/", async (req, res, next) => {
    try {
        const schema = z.object({
            bankName: z.string().optional(),
            bankAccountNumber: z.string().optional(),
            bankAccountName: z.string().optional(),
        });

        const data = schema.parse(req.body);

        // Upsert each setting
        const updates = Object.entries(data).map(([key, value]) =>
            prisma.systemSetting.upsert({
                where: { key },
                update: { value: value || "" },
                create: { key, value: value || "" },
            })
        );

        await Promise.all(updates);

        return res.json({ ok: true, message: "Settings saved" });
    } catch (err) {
        next(err);
    }
});

export default router;
