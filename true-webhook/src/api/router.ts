import { Router } from 'express';

import { accountsRouter } from './accounts.router';
import { telegramRouter } from './telegram.router';

export const apiRouter = Router();

apiRouter.get('/version', (_req, res) => {
  res.status(200).json({
    name: 'true-webhook',
    version: '0.1.0',
  });
});

apiRouter.use('/accounts', accountsRouter);
apiRouter.use('/telegram', telegramRouter);
