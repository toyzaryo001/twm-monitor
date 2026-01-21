// Tenant-scoped Accounts Router
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireTenantAccess, requireTenantAdmin } from '../../middleware/auth';
import { loadTenantFromPrefix } from '../../middleware/tenant';

export const tenantAccountsRouter = Router({ mergeParams: true });

// All routes require auth and tenant context
tenantAccountsRouter.use(requireAuth, requireTenantAccess, loadTenantFromPrefix);

const telegramConfigSchema = z
    .object({
        botToken: z.string().min(1),
        chatId: z.string().min(1),
        enabled: z.boolean().optional(),
        notifyMoneyIn: z.boolean().optional(),
        notifyMoneyOut: z.boolean().optional(),
    })
    .optional();

const createAccountSchema = z.object({
    name: z.string().min(1),
    trueWalletEndpointUrl: z.string().url(),
    trueWalletBearerToken: z.string().min(1),
    mobileNo: z.string().optional(),
    isActive: z.boolean().optional(),
    autoRefreshEnabled: z.boolean().optional(),
    autoRefreshIntervalSeconds: z.number().int().min(1).max(3600).optional(),
    telegramConfig: telegramConfigSchema,
});

const updateAccountSchema = createAccountSchema.partial();

// List accounts
tenantAccountsRouter.get('/', async (req, res, next) => {
    try {
        const prisma = req.tenantContext!.prisma;

        const accounts = await prisma.account.findMany({
            orderBy: { createdAt: 'desc' },
            include: { telegramConfig: true },
        });

        return res.status(200).json({ ok: true, data: accounts });
    } catch (err) {
        next(err);
    }
});

// Get single account
tenantAccountsRouter.get('/:id', async (req, res, next) => {
    try {
        const prisma = req.tenantContext!.prisma;

        const account = await prisma.account.findUnique({
            where: { id: req.params.id as string },
            include: { telegramConfig: true },
        });

        if (!account) {
            return res.status(404).json({ ok: false, error: 'ACCOUNT_NOT_FOUND' });
        }

        return res.status(200).json({ ok: true, data: account });
    } catch (err) {
        next(err);
    }
});

// Create account (Tenant Admin or Master only)
tenantAccountsRouter.post('/', requireTenantAdmin, async (req, res, next) => {
    try {
        const prisma = req.tenantContext!.prisma;
        const body = createAccountSchema.parse(req.body);

        const account = await prisma.account.create({
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

        return res.status(201).json({ ok: true, data: account });
    } catch (err) {
        next(err);
    }
});

// Update account (Tenant Admin or Master only)
tenantAccountsRouter.put('/:id', requireTenantAdmin, async (req, res, next) => {
    try {
        const prisma = req.tenantContext!.prisma;
        const body = updateAccountSchema.parse(req.body);

        const existing = await prisma.account.findUnique({
            where: { id: req.params.id as string },
            include: { telegramConfig: true },
        });

        if (!existing) {
            return res.status(404).json({ ok: false, error: 'ACCOUNT_NOT_FOUND' });
        }

        const account = await prisma.account.update({
            where: { id: req.params.id as string },
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
    } catch (err) {
        next(err);
    }
});

// Delete account (Tenant Admin or Master only)
tenantAccountsRouter.delete('/:id', requireTenantAdmin, async (req, res, next) => {
    try {
        const prisma = req.tenantContext!.prisma;

        await prisma.account.delete({ where: { id: req.params.id as string } });

        return res.status(204).send();
    } catch (err) {
        res.status(404).json({ ok: false, error: 'ACCOUNT_NOT_FOUND' });
    }
});
