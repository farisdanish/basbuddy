import { Router } from 'express';
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import {
  VALKEY_KEYS,
  checkPollerLiveness,
  type RoutesResponse,
  type RouteVehiclesResponse,
  type LiveVehicle,
  type VehiclePositionCache,
} from '@basbuddy/shared';

export const routesRouter = Router();

// ── GET /api/routes ────────────────────────────────────────────────────────────
// Returns all routes from Postgres (static data).
routesRouter.get('/routes', async (req, res) => {
  const pool = req.app.locals['pool'] as Pool;
  try {
    const result = await pool.query<{
      route_id: string;
      route_short_name: string;
      route_long_name: string;
      route_color: string;
    }>('SELECT route_id, route_short_name, route_long_name, route_color FROM routes ORDER BY route_short_name');

    const response: RoutesResponse = {
      routes: result.rows.map((r) => ({
        routeId: r.route_id,
        routeShortName: r.route_short_name,
        routeLongName: r.route_long_name,
        routeColor: r.route_color,
      })),
    };
    res.json(response);
  } catch (err) {
    console.error('[api/routes] DB error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /api/routes/:routeId/vehicles ─────────────────────────────────────────
// Returns live vehicle positions for a route, read from Valkey.
// 200 always — empty vehicles array if no live data.
routesRouter.get('/routes/:routeId/vehicles', async (req, res) => {
  const valkey = req.app.locals['valkey'] as Redis;
  const { routeId } = req.params;

  try {
    // Check poller liveness (heartbeat staleness)
    const pollerLastSuccess = await valkey.get(VALKEY_KEYS.pollerLastSuccess);
    const { healthy: pollerHealthy } = checkPollerLiveness(pollerLastSuccess);
    const pollerStale = !pollerHealthy;

    // Get active trip IDs for this route
    const tripIds = await valkey.smembers(VALKEY_KEYS.routeVehicles(routeId));


    const vehicles: LiveVehicle[] = [];

    if (tripIds.length > 0) {
      const keys = tripIds.map((id) => VALKEY_KEYS.vehicle(id));
      const rawValues = await valkey.mget(...keys);

      for (const raw of rawValues) {
        if (!raw) continue;
        const vc = JSON.parse(raw) as VehiclePositionCache;

        // Determine freshness
        const ageSeconds = vc.timestamp
          ? (Date.now() - new Date(vc.timestamp).getTime()) / 1000
          : Infinity;
        const freshness =
          pollerStale || ageSeconds > 240
            ? 'signal_lost'
            : ageSeconds > 120
              ? 'stale'
              : 'live';

        vehicles.push({
          tripId: vc.tripId,
          routeId: vc.routeId,
          lat: vc.lat,
          lon: vc.lon,
          bearing: vc.bearing,
          timestamp: vc.timestamp,
          freshness,
        });
      }
    }

    const response: RouteVehiclesResponse = { routeId, vehicles };
    res.json(response);
  } catch (err) {
    console.error(`[api/routes] Error for routeId=${routeId}:`, err);
    res.status(500).json({ error: 'internal_error' });
  }
});
