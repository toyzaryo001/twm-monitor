import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireMaster } from "../../middleware/auth";

const router = Router();

// Get contact settings
router.get("/", requireAuth, requireMaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const keys = ["contactLineId", "contactLineUrl", "contactFacebookUrl", "contactTelegramUrl", "contactPhone", "contactEmail"];

        const settings = await prisma.systemSetting.findMany({
            where: { key: { in: keys } }
        });

        const settingsMap: Record<string, string> = {};
        settings.forEach(s => {
            settingsMap[s.key] = s.value;
        });

        return res.json({
            ok: true,
            data: {
                lineId: settingsMap.contactLineId || "",
                lineUrl: settingsMap.contactLineUrl || "",
                facebookUrl: settingsMap.contactFacebookUrl || "",
                telegramUrl: settingsMap.contactTelegramUrl || "",
                phone: settingsMap.contactPhone || "",
                email: settingsMap.contactEmail || ""
            }
        });
    } catch (err) {
        next(err);
    }
});

// Update contact settings
router.put("/", requireAuth, requireMaster, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { lineId, lineUrl, facebookUrl, telegramUrl, phone, email } = req.body;

        const updates = [
            { key: "contactLineId", value: lineId || "" },
            { key: "contactLineUrl", value: lineUrl || "" },
            { key: "contactFacebookUrl", value: facebookUrl || "" },
            { key: "contactTelegramUrl", value: telegramUrl || "" },
            { key: "contactPhone", value: phone || "" },
            { key: "contactEmail", value: email || "" }
        ];

        for (const update of updates) {
            await prisma.systemSetting.upsert({
                where: { key: update.key },
                update: { value: update.value },
                create: { key: update.key, value: update.value }
            });
        }

        return res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

export default router;
