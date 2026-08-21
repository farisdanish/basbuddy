import { Router } from 'express';
import type { Pool } from 'pg';
import type {
  FavoritesResponse,
  CreateFavoriteBody,
  Favorite,
} from '@basbuddy/shared';

export const favoritesRouter = Router();

// ── GET /api/favorites ────────────────────────────────────────────────────────
favoritesRouter.get('/favorites', async (req, res) => {
  const pool = req.app.locals['pool'] as Pool;
  try {
    const result = await pool.query<{
      id: number; stop_id: string; route_id: string | null;
      label: string | null; created_at: string;
    }>('SELECT id, stop_id, route_id, label, created_at FROM favorites ORDER BY created_at DESC');

    const response: FavoritesResponse = {
      favorites: result.rows.map((r) => ({
        id: r.id,
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
  const pool = req.app.locals['pool'] as Pool;
  const body = req.body as CreateFavoriteBody;

  if (!body?.stopId) {
    res.status(400).json({ error: 'missing_stop_id' });
    return;
  }

  try {
    const result = await pool.query<{
      id: number; stop_id: string; route_id: string | null;
      label: string | null; created_at: string;
    }>(
      `INSERT INTO favorites (stop_id, route_id, label)
       VALUES ($1, $2, $3)
       RETURNING id, stop_id, route_id, label, created_at`,
      [body.stopId, body.routeId ?? null, body.label ?? null],
    );

    const row = result.rows[0]!;
    const favorite: Favorite = {
      id: row.id,
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
  const pool = req.app.locals['pool'] as Pool;
  const id = parseInt(req.params['id'] ?? '', 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }

  try {
    const result = await pool.query('DELETE FROM favorites WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    console.error('[api/favorites] DELETE error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});
