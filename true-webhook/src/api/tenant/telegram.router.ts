// Tenant-scoped Telegram Router
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireTenantAccess } from '../../middleware/auth';
import { loadTenantFromPrefix } from '../../middleware/tenant';

export const tenantTelegramRouter = Router({ mergeParams: true });

// All routes require auth and tenant context
tenantTelegramRouter.use(requireAuth, requireTenantAccess, loadTenantFromPrefix);

async function sendTelegramMessage(params: {
    botToken: string;
    chatId: string;
    text: string;
}) {
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

// Test telegram notification
tenantTelegramRouter.post('/test', async (req, res, next) => {
    try {
        const prisma = req.tenantContext!.prisma;
        const tenantName = req.tenantContext!.name;

        const body = z
            .object({
                accountId: z.string().min(1).optional(),
                botToken: z.string().min(1).optional(),
                chatId: z.string().min(1).optional(),
                text: z.string().min(1).optional(),
            })
            .refine(
                (v) => (v.accountId ? true : Boolean(v.botToken && v.chatId)),
                'Provide accountId or (botToken + chatId)'
            )
            .parse(req.body);

        let botToken = body.botToken ?? '';
        let chatId = body.chatId ?? '';

        if (body.accountId) {
            const account = await prisma.account.findUnique({
                where: { id: body.accountId },
                include: { telegramConfig: true },
            });

            if (!account || !account.telegramConfig) {
                return res.status(404).json({ ok: false, error: 'TELEGRAM_CONFIG_NOT_FOUND' });
            }

            botToken = account.telegramConfig.botToken;
            chatId = account.telegramConfig.chatId;
        }

        const testText = body.text ?? `🧪 Telegram test from ${tenantName}`;
        const result = await sendTelegramMessage({ botToken, chatId, text: testText });

        const payload = result.payload === null ? undefined : (result.payload as unknown as object);

        await prisma.notificationLog.create({
            data: {
                type: result.ok ? 'telegram_sent' : 'telegram_failed',
                message: result.ok ? 'Telegram test sent' : 'Telegram test failed',
                payload: payload as any,
                accountId: body.accountId,
            },
        });

        if (!result.ok) {
            return res.status(502).json({ ok: false, status: result.status, telegram: result.payload });
        }

        return res.status(200).json({ ok: true, telegram: result.payload });
    } catch (err) {
        next(err);
    }
});
