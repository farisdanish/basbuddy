import express, { type Express } from 'express';
import cors from 'cors';
import compression from 'compression';
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import {
  VALKEY_KEYS,
  checkPollerLiveness,
  type HealthResponse,
  type UpstreamHealthInfo,
  type StaticScheduleHealthInfo,
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
  app.use(
    cors({
      origin: origins,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'x-device-id', 'X-Device-Id', 'Authorization'],
    }),
  );
  app.use(express.json());

  // Attach shared dependencies so route handlers can access them
  app.locals['valkey'] = valkey;
  app.locals['pool'] = pool;

  // ── Routes ─────────────────────────────────────────────────────────────────
  app.use('/api', routesRouter);
  app.use('/api', stopsRouter);
  app.use('/api', favoritesRouter);

  // ── Health Check (Poller Heartbeat, Upstream & Static Schedule) ─────────────
  const healthHandler = async (_req: express.Request, res: express.Response) => {
    const v = _req.app.locals['valkey'] as Redis;
    const p = _req.app.locals['pool'] as Pool;

    const [pollerLastSuccess, upstreamHealthRaw, scheduleMetadataRaw] = await Promise.all([
      v.get(VALKEY_KEYS.pollerLastSuccess).catch(() => null),
      v.get(VALKEY_KEYS.upstreamHealth).catch(() => null),
      v.get(VALKEY_KEYS.scheduleMetadata).catch(() => null),
    ]);

    const liveness = checkPollerLiveness(pollerLastSuccess);

    // 1. Upstream data.gov.my telemetry
    let upstream: UpstreamHealthInfo | undefined;
    if (upstreamHealthRaw) {
      try {
        upstream = JSON.parse(upstreamHealthRaw);
      } catch {
        upstream = undefined;
      }
    } else if (liveness.healthy) {
      upstream = {
        status: 'operational',
        httpStatus: 200,
        responseTimeMs: null,
        feedTimestamp: pollerLastSuccess ?? null,
        lastSuccessAt: pollerLastSuccess ?? null,
        lastAttemptAt: pollerLastSuccess ?? new Date().toISOString(),
        activeVehiclesCount: 0,
        lastError: null,
      };
    } else if (pollerLastSuccess) {
      upstream = {
        status: 'degraded',
        httpStatus: null,
        responseTimeMs: null,
        feedTimestamp: pollerLastSuccess,
        lastSuccessAt: pollerLastSuccess,
        lastAttemptAt: new Date().toISOString(),
        activeVehiclesCount: 0,
        lastError: 'Feed delayed beyond 90s threshold',
      };
    }

    // 2. Static GTFS schedule ingestion diagnostics
    let schedule: StaticScheduleHealthInfo | undefined;
    if (scheduleMetadataRaw) {
      try {
        schedule = JSON.parse(scheduleMetadataRaw);
      } catch {
        schedule = undefined;
      }
    }

    if (!schedule && p) {
      try {
        // Query feed_sync_logs if present
        const syncRes = await p.query(
          `SELECT feed_id, status, routes_count, stops_count, trips_count, synced_at
           FROM feed_sync_logs
           WHERE status = 'success'
           ORDER BY synced_at DESC
           LIMIT 1`,
        );

        if (syncRes.rows.length > 0) {
          const row = syncRes.rows[0];
          const syncedDate = new Date(row.synced_at);
          const ageDays = (Date.now() - syncedDate.getTime()) / (1000 * 60 * 60 * 24);
          schedule = {
            lastIngestedAt: syncedDate.toISOString(),
            feedId: row.feed_id,
            routesCount: Number(row.routes_count),
            stopsCount: Number(row.stops_count),
            tripsCount: Number(row.trips_count),
            status: ageDays > 7 ? 'stale' : 'fresh',
          };
        } else {
          // Fallback: estimate from static tables
          const countRes = await p.query(
            `SELECT
              (SELECT count(*) FROM routes)::int AS routes_count,
              (SELECT count(*) FROM stops)::int AS stops_count,
              (SELECT count(*) FROM trips)::int AS trips_count`,
          );
          const r = countRes.rows[0];
          if (r && (r.routes_count > 0 || r.stops_count > 0)) {
            schedule = {
              lastIngestedAt: null,
              feedId: 'rapid-bus-kl',
              routesCount: Number(r.routes_count || 0),
              stopsCount: Number(r.stops_count || 0),
              tripsCount: Number(r.trips_count || 0),
              status: 'fresh',
            };
          }
        }

        if (schedule) {
          await v.set(VALKEY_KEYS.scheduleMetadata, JSON.stringify(schedule), 'EX', 300).catch(() => {});
        }
      } catch {
        // Table or pool query might fail in test environments; graceful ignore
      }
    }

    const response: HealthResponse = {
      status: liveness.healthy ? 'ok' : 'degraded',
      pollerHealthy: liveness.healthy,
      pollerAgeSeconds: Number.isFinite(liveness.ageSeconds)
        ? Math.round(liveness.ageSeconds)
        : -1,
      pollerLastSuccess: pollerLastSuccess ?? null,
      timestamp: new Date().toISOString(),
      upstream,
      schedule,
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
