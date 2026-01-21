import 'dotenv/config';

import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import next from 'next';
import path from 'path';
import { ZodError } from 'zod';

import { apiRouter } from './api/router';

const dev = process.env.NODE_ENV !== 'production';

// When compiled to dist/, __dirname becomes <project>/dist
// When running in dev (ts-node-dev), __dirname is <project>/src
const projectDir = path.join(__dirname, '..');

const nextApp = next({
  dev,
  dir: projectDir,
});
const handle = nextApp.getRequestHandler();

const port = Number.parseInt(process.env.PORT ?? '3000', 10);

async function main() {
  await nextApp.prepare();

  const app = express();

  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      ok: true,
      service: 'true-webhook',
      env: process.env.NODE_ENV ?? 'development',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api', apiRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({
        ok: false,
        error: 'VALIDATION_ERROR',
        details: err.issues,
      });
    }

    if (err instanceof Error && err.message === 'DATABASE_URL_NOT_SET') {
      return res.status(503).json({
        ok: false,
        error: 'DATABASE_NOT_CONFIGURED',
        message: 'Set DATABASE_URL in Railway Variables (or link the Postgres plugin variables).',
      });
    }

    return res.status(500).json({
      ok: false,
      error: 'INTERNAL_SERVER_ERROR',
    });
  });

  // Next.js handles everything else
  app.use((req, res) => handle(req, res));

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] listening on http://localhost:${port} (dev=${dev})`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] fatal error', err);
  process.exit(1);
});
