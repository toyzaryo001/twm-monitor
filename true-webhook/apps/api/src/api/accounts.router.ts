import { Router } from 'express';
import { z } from 'zod';

import { getPrisma } from '../lib/prisma';

export const accountsRouter = Router();

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

type CreateAccountBody = z.infer<typeof createAccountSchema>;

const updateAccountSchema = createAccountSchema.partial();

accountsRouter.get('/', async (_req, res, next) => {
  try {
    const prisma = getPrisma();
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: 'desc' },
      include: { telegramConfig: true },
    });

    res.status(200).json({ ok: true, data: accounts });
  } catch (err) {
    next(err);
  }
});

accountsRouter.get('/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const account = await prisma.account.findUnique({
      where: { id: req.params.id },
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

accountsRouter.post('/', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const body = createAccountSchema.parse(req.body) as CreateAccountBody;

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

    res.status(201).json({ ok: true, data: account });
  } catch (err) {
    next(err);
  }
});

accountsRouter.put('/:id', async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const body = updateAccountSchema.parse(req.body);

    const existing = await prisma.account.findUnique({
      where: { id: req.params.id },
      include: { telegramConfig: true },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: 'ACCOUNT_NOT_FOUND' });
    }

    const account = await prisma.account.update({
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
  } catch (err) {
    next(err);
  }
});

accountsRouter.delete('/:id', async (req, res) => {
  try {
    const prisma = getPrisma();
    await prisma.account.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (_err) {
    res.status(404).json({ ok: false, error: 'ACCOUNT_NOT_FOUND' });
  }
});
