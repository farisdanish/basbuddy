import { Router } from 'express';
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import {
  VALKEY_KEYS,
  POLLER_STALENESS_THRESHOLD_SECONDS,
  parseGtfsTime,
  type StopEtasResponse,
  type NearbyStopsResponse,
  type AllStopsResponse,
  type StopArrival,
} from '@basbuddy/shared';

export const stopsRouter = Router();

// ── GET /api/stops?near=lat,lon ────────────────────────────────────────────────
// Returns stops near a lat/lon using a bounding-box pre-filter + Haversine sort.
// Query params: near (required), radiusMeters (default 1000), limit (default 20, max 50)
stopsRouter.get('/stops', async (req, res) => {
  const pool = req.app.locals['pool'] as Pool;
  const { near, radiusMeters: radiusStr, limit: limitStr } = req.query;
  const feedId = req.query.feedId as string | undefined;

  if (!near || typeof near !== 'string') {
    // Return all stops (unscoped) if no ?near param — useful for search.
    // Note: LIMIT 500 is an intentional v1 constraint for RapidKL bus search.
    // Future multi-modal stop additions can expand this with cursor pagination.
    try {
      const result = feedId
        ? await pool.query<{
            stop_id: string;
            stop_name: string;
            stop_lat: number;
            stop_lon: number;
          }>('SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops WHERE feed_id = $1 ORDER BY stop_name LIMIT 500', [feedId])
        : await pool.query<{
            stop_id: string;
            stop_name: string;
            stop_lat: number;
            stop_lon: number;
          }>('SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops ORDER BY stop_name LIMIT 500');

      const response: AllStopsResponse = {
        stops: result.rows.map((r) => ({
          stopId: r.stop_id,
          stopName: r.stop_name,
          lat: r.stop_lat,
          lon: r.stop_lon,
        })),
      };
      res.json(response);
    } catch (err) {
      console.error('[api/stops] DB error:', err);
      res.status(500).json({ error: 'internal_error' });
    }
    return;
  }

  const parts = near.split(',');
  const lat = parseFloat(parts[0] ?? '');
  const lon = parseFloat(parts[1] ?? '');
  if (isNaN(lat) || isNaN(lon)) {
    res.status(400).json({ error: 'invalid_near_param', message: 'Expected ?near=lat,lon as decimals' });
    return;
  }

  const radiusMeters = Math.min(parseFloat(String(radiusStr ?? '1000')), 5000);
  const limit = Math.min(parseInt(String(limitStr ?? '20'), 10), 50);

  try {
    // Bounding box pre-filter — 1 degree ≈ 111,320m
    const latDelta = radiusMeters / 111_320;
    const lonDelta = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));

    const params: unknown[] = [lat - latDelta, lat + latDelta, lon - lonDelta, lon + lonDelta];
    let query = `SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops
       WHERE stop_lat BETWEEN $1 AND $2 AND stop_lon BETWEEN $3 AND $4`;

    if (feedId) {
      params.push(feedId);
      query += ` AND feed_id = $${params.length}`;
    }

    const result = await pool.query<{
      stop_id: string;
      stop_name: string;
      stop_lat: number;
      stop_lon: number;
    }>(query, params);

    // Haversine sort + radius filter in application code
    const withDist = result.rows
      .map((r) => ({
        stopId: r.stop_id,
        stopName: r.stop_name,
        lat: r.stop_lat,
        lon: r.stop_lon,
        distanceMeters: haversineMeters(lat, lon, r.stop_lat, r.stop_lon),
      }))
      .filter((s) => s.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);

    const response: NearbyStopsResponse = { origin: { lat, lon }, stops: withDist };
    res.json(response);
  } catch (err) {
    console.error('[api/stops] DB error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /api/stops/:stopId/etas ────────────────────────────────────────────────
// Primary: read StopEtasResponse from Valkey (poller-computed).
// Fallback: if cache miss, query static schedule from Postgres and mark signal_lost.
stopsRouter.get('/stops/:stopId/etas', async (req, res) => {
  const valkey = req.app.locals['valkey'] as Redis;
  const pool = req.app.locals['pool'] as Pool;
  const { stopId } = req.params;
  const feedId = (req.query.feedId as string | undefined) || 'rapid-bus-kl';

  try {
    // ── Check stop exists ─────────────────────────────────────────────────────
    const stopResult = await pool.query<{ stop_id: string; stop_name: string }>(
      'SELECT stop_id, stop_name FROM stops WHERE stop_id = $1 AND feed_id = $2',
      [stopId, feedId],
    );
    if (stopResult.rows.length === 0) {
      res.status(404).json({ error: 'stop_not_found' });
      return;
    }
    const stopName = stopResult.rows[0]!.stop_name;

    // ── Try Valkey cache first ────────────────────────────────────────────────
    const cached = await valkey.get(VALKEY_KEYS.stopEtas(stopId));
    if (cached) {
      const parsed = JSON.parse(cached) as StopEtasResponse;
      // Defense-in-depth: enrich stopName if absent from legacy/external cached payloads
      if (!parsed.stopName) parsed.stopName = stopName;
      const response: StopEtasResponse = parsed;
      res.json(response);
      return;
    }

    // ── Cache miss → static schedule fallback ─────────────────────────────────
    // §2: "On a cache miss, the API falls back to a static-schedule query against
    // Postgres and marks every returned arrival freshness: 'signal_lost', source: 'schedule'."
    //
    // Query respects calendar (§7–§8): only trips active today (Asia/Kuala_Lumpur).
    const nowKL = nowInKL();
    const dayOfWeek = nowKL.dayOfWeek; // 'monday' | 'tuesday' | ...
    const secondsSinceMidnight = nowKL.secondsSinceMidnight;
    const lookaheadSeconds = 3600; // 1 hour

    const scheduleResult = await pool.query<{
      trip_id: string;
      route_id: string;
      route_short_name: string;
      trip_headsign: string;
      arrival_time: string;
    }>(
      `SELECT st.trip_id, t.route_id, r.route_short_name, t.trip_headsign, st.arrival_time
       FROM stop_times st
       JOIN trips t ON t.feed_id = st.feed_id AND t.trip_id = st.trip_id
       JOIN routes r ON r.feed_id = t.feed_id AND r.route_id = t.route_id
       JOIN calendar c ON c.feed_id = t.feed_id AND c.service_id = t.service_id
       WHERE st.stop_id = $1
         AND st.feed_id = $2
         AND c.${dayOfWeek} = 1
         AND c.start_date <= CURRENT_DATE
         AND c.end_date >= CURRENT_DATE
       ORDER BY st.arrival_time
       LIMIT 20`,
      [stopId, feedId],
    );

    const arrivals: StopArrival[] = [];
    for (const row of scheduleResult.rows) {
      let etaSeconds: number;
      try {
        const arrivalSec = parseGtfsTime(row.arrival_time);
        etaSeconds = arrivalSec - secondsSinceMidnight;
        // GTFS times can exceed 24:00:00 — wrap to handle next-day service
        if (etaSeconds < 0) etaSeconds += 24 * 3600;
      } catch {
        continue; // skip malformed time
      }
      if (etaSeconds < 0 || etaSeconds > lookaheadSeconds) continue;

      arrivals.push({
        tripId: row.trip_id,
        routeId: row.route_id,
        routeShortName: row.route_short_name,
        tripHeadsign: row.trip_headsign,
        etaSeconds: Math.round(etaSeconds),
        source: 'schedule',
        freshness: 'signal_lost',
        vehicle: null,
      });
    }

    const response: StopEtasResponse = {
      stopId,
      stopName,
      generatedAt: new Date().toISOString(),
      arrivals,
    };
    res.json(response);
  } catch (err) {
    console.error(`[api/stops] Error for stopId=${stopId}:`, err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /api/stops/:stopId/timetable ──────────────────────────────────────────
// Returns all scheduled departures for a stop across all routes today.
stopsRouter.get('/stops/:stopId/timetable', async (req, res) => {
  const pool = req.app.locals['pool'] as Pool;
  const { stopId } = req.params;
  const feedId = (req.query.feedId as string | undefined) || 'rapid-bus-kl';

  try {
    const stopResult = await pool.query<{ stop_id: string; stop_name: string }>(
      'SELECT stop_id, stop_name FROM stops WHERE stop_id = $1 AND feed_id = $2',
      [stopId, feedId],
    );
    if (stopResult.rows.length === 0) {
      res.status(404).json({ error: 'stop_not_found' });
      return;
    }
    const stopName = stopResult.rows[0]!.stop_name;

    const nowKL = nowInKL();
    const dayOfWeek = nowKL.dayOfWeek;

    const scheduleResult = await pool.query<{
      trip_id: string;
      route_id: string;
      route_short_name: string;
      trip_headsign: string;
      departure_time: string;
      direction_id: number;
    }>(
      `SELECT st.trip_id, t.route_id, r.route_short_name, t.trip_headsign, st.departure_time, t.direction_id
       FROM stop_times st
       JOIN trips t ON t.feed_id = st.feed_id AND t.trip_id = st.trip_id
       JOIN routes r ON r.feed_id = t.feed_id AND r.route_id = t.route_id
       JOIN calendar c ON c.feed_id = t.feed_id AND c.service_id = t.service_id
       WHERE st.stop_id = $1
         AND st.feed_id = $2
         AND c.${dayOfWeek} = 1
         AND c.start_date <= CURRENT_DATE
         AND c.end_date >= CURRENT_DATE
       ORDER BY st.departure_time ASC`,
      [stopId, feedId],
    );

    const departures = scheduleResult.rows.map((row) => ({
      tripId: row.trip_id,
      routeId: row.route_id,
      routeShortName: row.route_short_name,
      tripHeadsign: row.trip_headsign,
      departureTime: row.departure_time,
      directionId: row.direction_id,
    }));

    const response = {
      stopId,
      stopName,
      departures,
    };
    res.json(response);
  } catch (err) {
    console.error(`[api/stops] Error for stop timetable stopId=${stopId}:`, err);
    res.status(500).json({ error: 'internal_error' });
  }
});


// ── Helpers ───────────────────────────────────────────────────────────────────

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type DayName = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

function nowInKL(): { dayOfWeek: DayName; secondsSinceMidnight: number } {
  // All calendar logic must use Asia/Kuala_Lumpur (UTC+8), never server default.
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
