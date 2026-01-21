"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
exports.accountsRouter = (0, express_1.Router)();
const telegramConfigSchema = zod_1.z
    .object({
    botToken: zod_1.z.string().min(1),
    chatId: zod_1.z.string().min(1),
    enabled: zod_1.z.boolean().optional(),
    notifyMoneyIn: zod_1.z.boolean().optional(),
    notifyMoneyOut: zod_1.z.boolean().optional(),
})
    .optional();
const createAccountSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    trueWalletEndpointUrl: zod_1.z.string().url(),
    trueWalletBearerToken: zod_1.z.string().min(1),
    mobileNo: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
    autoRefreshEnabled: zod_1.z.boolean().optional(),
    autoRefreshIntervalSeconds: zod_1.z.number().int().min(1).max(3600).optional(),
    telegramConfig: telegramConfigSchema,
});
const updateAccountSchema = createAccountSchema.partial();
exports.accountsRouter.get('/', async (_req, res, next) => {
    try {
        const accounts = await prisma_1.prisma.account.findMany({
            orderBy: { createdAt: 'desc' },
            include: { telegramConfig: true },
        });
        res.status(200).json({ ok: true, data: accounts });
    }
    catch (err) {
        next(err);
    }
});
exports.accountsRouter.get('/:id', async (req, res, next) => {
    try {
        const account = await prisma_1.prisma.account.findUnique({
            where: { id: req.params.id },
            include: { telegramConfig: true },
        });
        if (!account) {
            return res.status(404).json({ ok: false, error: 'ACCOUNT_NOT_FOUND' });
        }
        return res.status(200).json({ ok: true, data: account });
    }
    catch (err) {
        next(err);
    }
});
exports.accountsRouter.post('/', async (req, res, next) => {
    try {
        const body = createAccountSchema.parse(req.body);
        const account = await prisma_1.prisma.account.create({
            data: {
                name: body.name,
                isActive: body.isActive ?? true,
                trueWalletEndpointUrl: body.trueWalletEndpointUrl,
                trueWalletBearerToken: body.trueWalletBearerToken,
                mobileNo: body.mobileNo,
                autoRefreshEnabled: body.autoRefreshEnabled ?? true,
                autoRefreshIntervalSeconds: body.autoRefreshIntervalSeconds ?? 60,
                telegramConfig: body.telegramConfig
                    ? {
                        create: {
                            botToken: body.telegramConfig.botToken,
                            chatId: body.telegramConfig.chatId,
                            enabled: body.telegramConfig.enabled ?? true,
                            notifyMoneyIn: body.telegramConfig.notifyMoneyIn ?? true,
                            notifyMoneyOut: body.telegramConfig.notifyMoneyOut ?? true,
                        },
                    }
                    : undefined,
            },
            include: { telegramConfig: true },
        });
        res.status(201).json({ ok: true, data: account });
    }
    catch (err) {
        next(err);
    }
});
exports.accountsRouter.put('/:id', async (req, res, next) => {
    try {
        const body = updateAccountSchema.parse(req.body);
        const existing = await prisma_1.prisma.account.findUnique({
            where: { id: req.params.id },
            include: { telegramConfig: true },
        });
        if (!existing) {
            return res.status(404).json({ ok: false, error: 'ACCOUNT_NOT_FOUND' });
        }
        const account = await prisma_1.prisma.account.update({
            where: { id: req.params.id },
            data: {
                name: body.name,
                isActive: body.isActive,
                trueWalletEndpointUrl: body.trueWalletEndpointUrl,
                trueWalletBearerToken: body.trueWalletBearerToken,
                mobileNo: body.mobileNo,
                autoRefreshEnabled: body.autoRefreshEnabled,
                autoRefreshIntervalSeconds: body.autoRefreshIntervalSeconds,
                telegramConfig: body.telegramConfig
                    ? existing.telegramConfig
                        ? {
                            update: {
                                botToken: body.telegramConfig.botToken,
                                chatId: body.telegramConfig.chatId,
                                enabled: body.telegramConfig.enabled,
                                notifyMoneyIn: body.telegramConfig.notifyMoneyIn,
                                notifyMoneyOut: body.telegramConfig.notifyMoneyOut,
                            },
                        }
                        : {
                            create: {
                                botToken: body.telegramConfig.botToken,
                                chatId: body.telegramConfig.chatId,
                                enabled: body.telegramConfig.enabled ?? true,
                                notifyMoneyIn: body.telegramConfig.notifyMoneyIn ?? true,
                                notifyMoneyOut: body.telegramConfig.notifyMoneyOut ?? true,
                            },
                        }
                    : undefined,
            },
            include: { telegramConfig: true },
        });
        return res.status(200).json({ ok: true, data: account });
    }
    catch (err) {
        next(err);
    }
});
exports.accountsRouter.delete('/:id', async (req, res, next) => {
    try {
        await prisma_1.prisma.account.delete({ where: { id: req.params.id } });
        res.status(204).send();
    }
    catch (err) {
        // Prisma throws if not found
        res.status(404).json({ ok: false, error: 'ACCOUNT_NOT_FOUND' });
    }
});
//# sourceMappingURL=accounts.router.js.map