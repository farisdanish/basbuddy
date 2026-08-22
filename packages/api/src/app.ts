import express, { type Express } from 'express';
import cors from 'cors';
import compression from 'compression';
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import {
  VALKEY_KEYS,
  checkPollerLiveness,
  type HealthResponse,
} from '@basbuddy/shared';
import { routesRouter } from './routes/routes.js';
import { stopsRouter } from './routes/stops.js';
import { favoritesRouter } from './routes/favorites.js';

export interface AppOptions {
  valkey: Redis;
  pool: Pool;
  corsOrigins?: string[];
}

export function createApp(options: AppOptions): Express {
  const { valkey, pool, corsOrigins } = options;
  const origins =
    corsOrigins ??
    (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim());

  const app = express();

  app.use(compression());
  app.use(cors({ origin: origins, methods: ['GET', 'POST', 'DELETE'] }));
  app.use(express.json());

  // Attach shared dependencies so route handlers can access them
  app.locals['valkey'] = valkey;
  app.locals['pool'] = pool;

  // ── Routes ─────────────────────────────────────────────────────────────────
  app.use('/api', routesRouter);
  app.use('/api', stopsRouter);
  app.use('/api', favoritesRouter);

  // ── Health Check (Poller Heartbeat & Liveness) ──────────────────────────────
  const healthHandler = async (_req: express.Request, res: express.Response) => {
    const v = _req.app.locals['valkey'] as Redis;
    const pollerLastSuccess = await v.get(VALKEY_KEYS.pollerLastSuccess);
    const liveness = checkPollerLiveness(pollerLastSuccess);

    const response: HealthResponse = {
      status: liveness.healthy ? 'ok' : 'degraded',
      pollerHealthy: liveness.healthy,
      pollerAgeSeconds: Number.isFinite(liveness.ageSeconds)
        ? Math.round(liveness.ageSeconds)
        : -1,
      pollerLastSuccess: pollerLastSuccess ?? null,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // 404 catch-all
  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  return app;
}
