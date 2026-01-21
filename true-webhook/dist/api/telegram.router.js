"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
exports.telegramRouter = (0, express_1.Router)();
async function sendTelegramMessage(params) {
    const url = `https://api.telegram.org/bot${params.botToken}/sendMessage`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: params.chatId, text: params.text }),
    });
    const payload = await response.json().catch(() => null);
    return {
        ok: response.ok,
        status: response.status,
        payload,
    };
}
exports.telegramRouter.post('/test', async (req, res, next) => {
    try {
        const body = zod_1.z
            .object({
            accountId: zod_1.z.string().min(1).optional(),
            botToken: zod_1.z.string().min(1).optional(),
            chatId: zod_1.z.string().min(1).optional(),
            text: zod_1.z.string().min(1).default('🧪 Telegram test message'),
        })
            .refine((v) => (v.accountId ? true : Boolean(v.botToken && v.chatId)), 'Provide accountId or (botToken + chatId)')
            .parse(req.body);
        let botToken = body.botToken ?? '';
        let chatId = body.chatId ?? '';
        if (body.accountId) {
            const account = await prisma_1.prisma.account.findUnique({
                where: { id: body.accountId },
                include: { telegramConfig: true },
            });
            if (!account || !account.telegramConfig) {
                return res.status(404).json({ ok: false, error: 'TELEGRAM_CONFIG_NOT_FOUND' });
            }
            botToken = account.telegramConfig.botToken;
            chatId = account.telegramConfig.chatId;
        }
        const result = await sendTelegramMessage({ botToken, chatId, text: body.text });
        const payload = result.payload === null ? undefined : result.payload;
        await prisma_1.prisma.notificationLog.create({
            data: {
                type: result.ok ? 'telegram_sent' : 'telegram_failed',
                message: result.ok ? 'Telegram test sent' : 'Telegram test failed',
                payload,
                accountId: body.accountId,
            },
        });
        if (!result.ok) {
            return res.status(502).json({ ok: false, status: result.status, telegram: result.payload });
        }
        return res.status(200).json({ ok: true, telegram: result.payload });
    }
    catch (err) {
        next(err);
    }
});
//# sourceMappingURL=telegram.router.js.map