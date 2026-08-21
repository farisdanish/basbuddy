import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { routesRouter } from './routes/routes.js';
import { stopsRouter } from './routes/stops.js';
import { favoritesRouter } from './routes/favorites.js';

// ─── BasBuddy API Server ───────────────────────────────────────────────────────
// Stateless — reads from Valkey (realtime cache) and Postgres (static schedule).
// Never calls data.gov.my directly; that is exclusively the poller's job.

const PORT = parseInt(process.env.API_PORT ?? '3001', 10);
const HOST = process.env.API_HOST ?? '0.0.0.0';
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim());

async function main(): Promise<void> {
  // ── Valkey ─────────────────────────────────────────────────────────────────
  const valkey = new Redis({
    host: process.env.VALKEY_HOST ?? 'localhost',
    port: parseInt(process.env.VALKEY_PORT ?? '6379', 10),
    password: process.env.VALKEY_PASSWORD || undefined,
    lazyConnect: true,
  });
  await valkey.connect();
  console.log('[api] Connected to Valkey.');

  // ── Postgres ───────────────────────────────────────────────────────────────
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    database: process.env.POSTGRES_DB ?? 'basbuddy',
    user: process.env.POSTGRES_USER ?? 'basbuddy',
    password: process.env.POSTGRES_PASSWORD,
  });

  // ── Express app ────────────────────────────────────────────────────────────
  const app = express();

  app.use(compression());
  app.use(cors({ origin: CORS_ORIGINS, methods: ['GET', 'POST', 'DELETE'] }));
  app.use(express.json());

  // Attach shared dependencies so route handlers can access them
  app.locals['valkey'] = valkey;
  app.locals['pool'] = pool;

  // ── Routes ─────────────────────────────────────────────────────────────────
  app.use('/api', routesRouter);
  app.use('/api', stopsRouter);
  app.use('/api', favoritesRouter);

  // Health check (also used to verify poller liveness from monitoring)
  app.get('/health', async (_req, res) => {
    const pollerLastSuccess = await valkey.get('poller:last_success');
    res.json({
      status: 'ok',
      pollerLastSuccess: pollerLastSuccess ?? null,
      timestamp: new Date().toISOString(),
    });
  });

  // 404 catch-all
  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  // ── Listen ─────────────────────────────────────────────────────────────────
  app.listen(PORT, HOST, () => {
    console.log(`[api] BasBuddy API listening on http://${HOST}:${PORT}`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async () => {
    console.log('[api] Shutting down...');
    await valkey.quit();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[api] ✗ Fatal startup error:', err);
  process.exit(1);
});
