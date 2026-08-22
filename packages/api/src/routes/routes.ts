import { Router } from 'express';
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import {
  VALKEY_KEYS,
  checkPollerLiveness,
  parseGtfsTime,
  type RoutesResponse,
  type RouteDetailsResponse,
  type RouteStopItem,
  type RouteVehiclesResponse,
  type LiveVehicle,
  type VehiclePositionCache,
  type RouteTimetable,
  type RouteScheduledDeparture,
} from '@basbuddy/shared';

export const routesRouter = Router();

type DayName = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

function nowInKL(): { dayOfWeek: DayName; secondsSinceMidnight: number } {
  const now = new Date();
  const klFormatter = new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = klFormatter.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';

  const weekdayMap: Record<string, DayName> = {
    Monday: 'monday', Tuesday: 'tuesday', Wednesday: 'wednesday',
    Thursday: 'thursday', Friday: 'friday', Saturday: 'saturday', Sunday: 'sunday',
  };
  const dayOfWeek = weekdayMap[get('weekday')] ?? 'monday';
  const h = parseInt(get('hour'), 10);
  const m = parseInt(get('minute'), 10);
  const s = parseInt(get('second'), 10);
  const secondsSinceMidnight = h * 3600 + m * 60 + s;

  return { dayOfWeek, secondsSinceMidnight };
}

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

// ── GET /api/routes/:routeId ──────────────────────────────────────────────────
// Returns detailed route info including polyline shapes, ordered stops, directions, and live vehicles.
routesRouter.get('/routes/:routeId', async (req, res) => {
  const pool = req.app.locals['pool'] as Pool;
  const valkey = req.app.locals['valkey'] as Redis;
  const { routeId } = req.params;

  try {
    // 1. Get route basic info
    const routeRes = await pool.query<{
      route_id: string;
      route_short_name: string;
      route_long_name: string;
      route_color: string;
    }>(
      'SELECT route_id, route_short_name, route_long_name, route_color FROM routes WHERE route_id = $1',
      [routeId],
    );

    if (routeRes.rowCount === 0) {
      res.status(404).json({ error: 'not_found', message: `Route ${routeId} not found` });
      return;
    }

    const route = routeRes.rows[0]!;

    // 2. Get distinct directions & headsigns
    const dirRes = await pool.query<{
      direction_id: number;
      trip_headsign: string;
      shape_id: string;
      trip_id: string;
    }>(
      `SELECT DISTINCT ON (direction_id) direction_id, trip_headsign, shape_id, trip_id
       FROM trips
       WHERE route_id = $1
       ORDER BY direction_id, trip_id`,
      [routeId],
    );

    const directions = dirRes.rows.map((d) => ({
      directionId: d.direction_id,
      tripHeadsign: d.trip_headsign,
    }));

    const sampleTripId = dirRes.rows[0]?.trip_id;
    const sampleShapeId = dirRes.rows.find((d) => d.shape_id && d.shape_id.trim() !== '')?.shape_id;

    // 3. Get shapes (polyline points)
    let shapes: Array<[number, number]> = [];
    if (sampleShapeId) {
      const shapeRes = await pool.query<{
        shape_pt_lat: number;
        shape_pt_lon: number;
      }>(
        'SELECT shape_pt_lat, shape_pt_lon FROM shapes WHERE shape_id = $1 ORDER BY shape_pt_sequence ASC',
        [sampleShapeId],
      );
      shapes = shapeRes.rows.map((s) => [s.shape_pt_lat, s.shape_pt_lon]);
    }

    // 4. Get stops along representative trip
    let stops: RouteStopItem[] = [];
    if (sampleTripId) {
      const stopsRes = await pool.query<{
        stop_id: string;
        stop_name: string;
        stop_lat: number;
        stop_lon: number;
        stop_sequence: number;
      }>(
        `SELECT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon, st.stop_sequence
         FROM stop_times st
         JOIN stops s ON s.stop_id = st.stop_id
         WHERE st.trip_id = $1
         ORDER BY st.stop_sequence ASC`,
        [sampleTripId],
      );
      stops = stopsRes.rows.map((s) => ({
        stopId: s.stop_id,
        stopName: s.stop_name,
        lat: s.stop_lat,
        lon: s.stop_lon,
        stopSequence: s.stop_sequence,
      }));
    }

    // If shapes is empty but stops exist, use stop coordinates as polyline fallback
    if (shapes.length === 0 && stops.length > 0) {
      shapes = stops.map((s) => [s.lat, s.lon]);
    }

    // 5. Get live vehicles from Valkey
    const pollerLastSuccess = await valkey.get(VALKEY_KEYS.pollerLastSuccess);
    const { healthy: pollerHealthy } = checkPollerLiveness(pollerLastSuccess);
    const pollerStale = !pollerHealthy;

    const tripIds = await valkey.smembers(VALKEY_KEYS.routeVehicles(routeId));
    const vehicles: LiveVehicle[] = [];

    if (tripIds.length > 0) {
      const keys = tripIds.map((id) => VALKEY_KEYS.vehicle(id));
      const rawValues = await valkey.mget(...keys);

      for (const raw of rawValues) {
        if (!raw) continue;
        const vc = JSON.parse(raw) as VehiclePositionCache;
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

    // 6. Get static timetable departures for this route today
    let timetable: RouteTimetable | null = null;
    try {
      const nowKL = nowInKL();
      const dayOfWeek = nowKL.dayOfWeek;
      const secondsSinceMidnight = nowKL.secondsSinceMidnight;

      const departuresRes = await pool.query<{
        trip_id: string;
        direction_id: number;
        trip_headsign: string;
        departure_time: string;
      }>(
        `SELECT DISTINCT ON (t.trip_id) t.trip_id, t.direction_id, t.trip_headsign, st.departure_time
         FROM trips t
         JOIN calendar c ON c.service_id = t.service_id
         JOIN stop_times st ON st.trip_id = t.trip_id
         WHERE t.route_id = $1
           AND c.${dayOfWeek} = 1
           AND c.start_date <= CURRENT_DATE
           AND c.end_date >= CURRENT_DATE
         ORDER BY t.trip_id, st.stop_sequence ASC`,
        [routeId],
      );

      if (departuresRes.rows.length > 0) {
        // Sort departures chronologically by departure_time
        const allDepartures: RouteScheduledDeparture[] = departuresRes.rows
          .map((row) => ({
            tripId: row.trip_id,
            departureTime: row.departure_time,
            tripHeadsign: row.trip_headsign,
            directionId: row.direction_id,
          }))
          .sort((a, b) => {
            try {
              return parseGtfsTime(a.departureTime) - parseGtfsTime(b.departureTime);
            } catch {
              return a.departureTime.localeCompare(b.departureTime);
            }
          });

        const nextDepartures = allDepartures.filter((d) => {
          try {
            return parseGtfsTime(d.departureTime) >= secondsSinceMidnight;
          } catch {
            return true;
          }
        });

        timetable = {
          firstBusTime: allDepartures[0]?.departureTime ?? null,
          lastBusTime: allDepartures[allDepartures.length - 1]?.departureTime ?? null,
          totalTripsToday: allDepartures.length,
          nextDepartures,
          allDepartures,
        };
      }
    } catch (timetableErr) {
      console.warn(`[api/routes] Timetable calculation warning for routeId=${routeId}:`, timetableErr);
    }

    const response: RouteDetailsResponse = {
      routeId: route.route_id,
      routeShortName: route.route_short_name,
      routeLongName: route.route_long_name,
      routeColor: route.route_color,
      directions,
      shapes,
      stops,
      vehicles,
      timetable,
    };

    res.json(response);
  } catch (err) {
    console.error(`[api/routes] Error for routeId=${routeId}:`, err);
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
