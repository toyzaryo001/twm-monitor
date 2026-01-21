import 'dotenv/config';

import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';

import { apiRouter } from './api/router';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);

function getCorsOptions() {
  const origin = process.env.CORS_ORIGIN;
  if (!origin || origin.trim() === '*') {
    return { origin: true };
  }

  const allowList = origin
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    origin: (requestOrigin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => {
      if (!requestOrigin) return cb(null, true);
      if (allowList.includes(requestOrigin)) return cb(null, true);
      return cb(new Error('CORS_NOT_ALLOWED'));
    },
  };
}

async function main() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors(getCorsOptions()));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      ok: true,
      service: 'twm-monitor-api',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api', apiRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ ok: false, error: 'VALIDATION_ERROR', details: err.issues });
    }

    if (err instanceof Error && err.message === 'DATABASE_URL_NOT_SET') {
      return res.status(503).json({
        ok: false,
        error: 'DATABASE_NOT_CONFIGURED',
        message: 'Set DATABASE_URL in Railway Variables (or connect Postgres variables to this service).',
      });
    }

    if (err instanceof Error && err.message === 'CORS_NOT_ALLOWED') {
      return res.status(403).json({ ok: false, error: 'CORS_NOT_ALLOWED' });
    }

    return res.status(500).json({ ok: false, error: 'INTERNAL_SERVER_ERROR' });
  });

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] listening on :${port}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[api] fatal error', err);
  process.exit(1);
});
