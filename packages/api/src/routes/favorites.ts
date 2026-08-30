import { Router } from 'express';
import type { Pool } from 'pg';
import type {
  FavoritesResponse,
  CreateFavoriteBody,
  Favorite,
} from '@basbuddy/shared';
import { requireDeviceId } from '../middleware/requireDeviceId.js';

export const favoritesRouter = Router();

// Enforce device scoping for all favorites endpoints
favoritesRouter.use('/favorites', requireDeviceId);

// ── GET /api/favorites ────────────────────────────────────────────────────────
favoritesRouter.get('/favorites', async (_req, res) => {
  const pool = res.app.locals['pool'] as Pool;
  const deviceId = res.locals['deviceId'] as string;

  try {
    const result = await pool.query<{
      id: number;
      feed_id: string;
      stop_id: string | null;
      route_id: string | null;
      label: string | null;
      created_at: string;
    }>(
      `SELECT id, feed_id, stop_id, route_id, label, created_at
       FROM favorites
       WHERE device_id = $1
       ORDER BY created_at DESC`,
      [deviceId],
    );

    const response: FavoritesResponse = {
      favorites: result.rows.map((r) => ({
        id: r.id,
        feedId: r.feed_id,
        stopId: r.stop_id,
        routeId: r.route_id,
        label: r.label,
        createdAt: r.created_at,
      })),
    };
    res.json(response);
  } catch (err) {
    console.error('[api/favorites] GET error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/favorites ───────────────────────────────────────────────────────
favoritesRouter.post('/favorites', async (req, res) => {
  const pool = res.app.locals['pool'] as Pool;
  const deviceId = res.locals['deviceId'] as string;
  const body = req.body as CreateFavoriteBody;

  if (!body?.stopId && !body?.routeId) {
    res.status(400).json({ error: 'missing_target', message: 'Either stopId or routeId must be provided' });
    return;
  }

  const feedId = body.feedId || 'rapid-bus-kl';

  try {
    const result = await pool.query<{
      id: number;
      feed_id: string;
      stop_id: string | null;
      route_id: string | null;
      label: string | null;
      created_at: string;
    }>(
      `INSERT INTO favorites (feed_id, stop_id, route_id, label, device_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, feed_id, stop_id, route_id, label, created_at`,
      [feedId, body.stopId ?? null, body.routeId ?? null, body.label ?? null, deviceId],
    );

    const row = result.rows[0]!;
    const favorite: Favorite = {
      id: row.id,
      feedId: row.feed_id,
      stopId: row.stop_id,
      routeId: row.route_id,
      label: row.label,
      createdAt: row.created_at,
    };
    res.status(201).json(favorite);
  } catch (err: unknown) {
    // FK violation = stop_id or route_id doesn't exist
    if ((err as { code?: string }).code === '23503') {
      res.status(400).json({ error: 'invalid_stop_or_route', message: 'stop_id or route_id not found' });
      return;
    }
    console.error('[api/favorites] POST error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── DELETE /api/favorites/:id ─────────────────────────────────────────────────
favoritesRouter.delete('/favorites/:id', async (req, res) => {
  const pool = res.app.locals['pool'] as Pool;
  const deviceId = res.locals['deviceId'] as string;
  const id = parseInt(req.params['id'] ?? '', 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }

  try {
    const result = await pool.query(
      'DELETE FROM favorites WHERE id = $1 AND device_id = $2',
      [id, deviceId],
    );
    if (result.rowCount === 0) {
      // Return 404 (not 403) to avoid leaking existence of other devices' favorites
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    console.error('[api/favorites] DELETE error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});
