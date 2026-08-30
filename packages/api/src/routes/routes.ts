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
// Returns routes from Postgres (static data) along with active live bus counts from Valkey.
// Supports optional ?near=lat,lon&radiusMeters=25000&limit=20 for proximity sorting.
routesRouter.get('/routes', async (req, res) => {
  const pool = req.app.locals['pool'] as Pool;
  const valkey = req.app.locals['valkey'] as Redis | undefined;
  const { near, radiusMeters: radiusStr, limit: limitStr } = req.query;
  const feedId = req.query.feedId as string | undefined;

  try {
    if (near && typeof near === 'string') {
      const parts = near.split(',');
      const lat = parseFloat(parts[0] ?? '');
      const lon = parseFloat(parts[1] ?? '');
      if (isNaN(lat) || isNaN(lon)) {
        res.status(400).json({ error: 'invalid_near_param', message: 'Expected ?near=lat,lon as decimals' });
        return;
      }

      const radiusMeters = Math.min(parseFloat(String(radiusStr ?? '25000')), 50000);
      const limit = Math.min(parseInt(String(limitStr ?? '50'), 10), 100);

      // Bounding box pre-filter
      const latDelta = radiusMeters / 111_320;
      const lonDelta = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
      const minLat = lat - latDelta;
      const maxLat = lat + latDelta;
      const minLon = lon - lonDelta;
      const maxLon = lon + lonDelta;

      const params: unknown[] = [lat, lon, minLat, maxLat, minLon, maxLon, radiusMeters, limit];
      let query = `SELECT r.route_id, r.route_short_name, r.route_long_name, r.route_color,
                ROUND(MIN(
                  6371000 * acos(
                    LEAST(1.0, GREATEST(-1.0,
                      cos(radians($1)) * cos(radians(s.stop_lat)) *
                      cos(radians(s.stop_lon) - radians($2)) +
                      sin(radians($1)) * sin(radians(s.stop_lat))
                    ))
                  )
                )) AS distance_meters
         FROM routes r
         JOIN trips t ON t.feed_id = r.feed_id AND t.route_id = r.route_id
         JOIN stop_times st ON st.feed_id = t.feed_id AND st.trip_id = t.trip_id
         JOIN stops s ON s.feed_id = st.feed_id AND s.stop_id = st.stop_id
         WHERE s.stop_lat BETWEEN $3 AND $4
           AND s.stop_lon BETWEEN $5 AND $6`;

      if (feedId) {
        params.push(feedId);
        query += ` AND r.feed_id = $${params.length}`;
      }

      query += ` GROUP BY r.route_id, r.route_short_name, r.route_long_name, r.route_color
         HAVING MIN(
                  6371000 * acos(
                    LEAST(1.0, GREATEST(-1.0,
                      cos(radians($1)) * cos(radians(s.stop_lat)) *
                      cos(radians(s.stop_lon) - radians($2)) +
                      sin(radians($1)) * sin(radians(s.stop_lat))
                    ))
                  )
                ) <= $7
         ORDER BY distance_meters ASC
         LIMIT $8`;

      const result = await pool.query<{
        route_id: string;
        route_short_name: string;
        route_long_name: string;
        route_color: string;
        distance_meters: number;
      }>(query, params);

      const liveCounts: Record<string, number> = {};
      if (valkey && result.rows.length > 0 && typeof valkey.pipeline === 'function') {
        try {
          const pipeline = valkey.pipeline();
          for (const r of result.rows) {
            pipeline.scard(VALKEY_KEYS.routeVehicles(r.route_id));
          }
          const counts = await pipeline.exec();
          if (counts) {
            counts.forEach(([err, count], idx) => {
              if (!err && typeof count === 'number') {
                const routeId = result.rows[idx]!.route_id;
                liveCounts[routeId] = count;
              }
            });
          }
        } catch (cacheErr) {
          console.warn('[api/routes] Valkey live count lookup warning:', cacheErr);
        }
      }

      const response: RoutesResponse = {
        routes: result.rows.map((r) => ({
          routeId: r.route_id,
          routeShortName: r.route_short_name,
          routeLongName: r.route_long_name,
          routeColor: r.route_color,
          liveBusCount: liveCounts[r.route_id] ?? 0,
          distanceMeters: Number(r.distance_meters),
        })),
      };
      res.json(response);
      return;
    }

    // Standard unscoped GET /api/routes
    const result = feedId
      ? await pool.query<{
          route_id: string;
          route_short_name: string;
          route_long_name: string;
          route_color: string;
        }>('SELECT route_id, route_short_name, route_long_name, route_color FROM routes WHERE feed_id = $1 ORDER BY route_short_name', [feedId])
      : await pool.query<{
          route_id: string;
          route_short_name: string;
          route_long_name: string;
          route_color: string;
        }>('SELECT route_id, route_short_name, route_long_name, route_color FROM routes ORDER BY route_short_name');

    const liveCounts: Record<string, number> = {};
    if (valkey && result.rows.length > 0 && typeof valkey.pipeline === 'function') {
      try {
        const pipeline = valkey.pipeline();
        for (const r of result.rows) {
          pipeline.scard(VALKEY_KEYS.routeVehicles(r.route_id));
        }
        const counts = await pipeline.exec();
        if (counts) {
          counts.forEach(([err, count], idx) => {
            if (!err && typeof count === 'number') {
              const routeId = result.rows[idx]!.route_id;
              liveCounts[routeId] = count;
            }
          });
        }
      } catch (cacheErr) {
        console.warn('[api/routes] Valkey live count lookup warning:', cacheErr);
      }
    }

    const response: RoutesResponse = {
      routes: result.rows.map((r) => ({
        routeId: r.route_id,
        routeShortName: r.route_short_name,
        routeLongName: r.route_long_name,
        routeColor: r.route_color,
        liveBusCount: liveCounts[r.route_id] ?? 0,
      })),
    };
    res.json(response);
  } catch (err) {
    console.error('[api/routes] DB error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── GET /api/routes/:routeId ──────────────────────────────────────────────────
// Returns detailed route info including polyline shapes, ordered stops, directions, and live vehicles.
routesRouter.get('/routes/:routeId', async (req, res) => {
  const pool = req.app.locals['pool'] as Pool;
  const valkey = req.app.locals['valkey'] as Redis;
  const { routeId } = req.params;
  const feedId = (req.query.feedId as string | undefined) || 'rapid-bus-kl';

  try {
    // 1. Get route basic info
    const routeRes = await pool.query<{
      route_id: string;
      route_short_name: string;
      route_long_name: string;
      route_color: string;
    }>(
      'SELECT route_id, route_short_name, route_long_name, route_color FROM routes WHERE route_id = $1 AND feed_id = $2',
      [routeId, feedId],
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
       WHERE route_id = $1 AND feed_id = $2
       ORDER BY direction_id, trip_id`,
      [routeId, feedId],
    );

    const directions = [];
    let primaryShapes: Array<[number, number]> = [];
    let primaryStops: RouteStopItem[] = [];

    // For each direction found:
    for (let i = 0; i < dirRes.rows.length; i++) {
      const d = dirRes.rows[i]!;
      let dirShapes: Array<[number, number]> = [];
      if (d.shape_id && d.shape_id.trim() !== '') {
        const shapeRes = await pool.query<{
          shape_pt_lat: number;
          shape_pt_lon: number;
        }>(
          'SELECT shape_pt_lat, shape_pt_lon FROM shapes WHERE shape_id = $1 AND feed_id = $2 ORDER BY shape_pt_sequence ASC',
          [d.shape_id, feedId],
        );
        dirShapes = shapeRes.rows.map((s) => [s.shape_pt_lat, s.shape_pt_lon]);
      }

      let dirStops: RouteStopItem[] = [];
      if (d.trip_id) {
        const stopsRes = await pool.query<{
          stop_id: string;
          stop_name: string;
          stop_lat: number;
          stop_lon: number;
          stop_sequence: number;
          arrival_time?: string;
          departure_time?: string;
        }>(
          `SELECT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon, st.stop_sequence, st.arrival_time, st.departure_time
           FROM stop_times st
           JOIN stops s ON s.feed_id = st.feed_id AND s.stop_id = st.stop_id
           WHERE st.trip_id = $1 AND st.feed_id = $2
           ORDER BY st.stop_sequence ASC`,
          [d.trip_id, feedId],
        );
        dirStops = stopsRes.rows.map((s) => ({
          stopId: s.stop_id,
          stopName: s.stop_name,
          lat: s.stop_lat,
          lon: s.stop_lon,
          stopSequence: s.stop_sequence,
          scheduledTime: s.departure_time || s.arrival_time || null,
        }));
      }

      if (dirShapes.length === 0 && dirStops.length > 0) {
        dirShapes = dirStops.map((s) => [s.lat, s.lon]);
      }

      directions.push({
        directionId: d.direction_id,
        tripHeadsign: d.trip_headsign,
        stops: dirStops,
        shapes: dirShapes,
      });

      if (i === 0) {
        primaryShapes = dirShapes;
        primaryStops = dirStops;
      }
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

        // Find nearest stop along route stops for progress tracking
        let nearestStopId: string | null = null;
        let nextStopId: string | null = null;
        let minDistance = Infinity;
        let nearestIdx = -1;

        for (let i = 0; i < primaryStops.length; i++) {
          const st = primaryStops[i]!;
          const d = haversineDistanceMeters(vc.lat, vc.lon, st.lat, st.lon);
          if (d < minDistance) {
            minDistance = d;
            nearestStopId = st.stopId;
            nearestIdx = i;
          }
        }

        if (nearestIdx >= 0 && nearestIdx < primaryStops.length - 1) {
          nextStopId = primaryStops[nearestIdx + 1]?.stopId ?? null;
        } else if (nearestIdx >= 0) {
          nextStopId = primaryStops[nearestIdx]?.stopId ?? null;
        }

        // Calculate downstream stop ETAs if vehicle is live/stale
        if (freshness !== 'signal_lost' && nearestIdx >= 0) {
          const AVG_SPEED_MS = (25 * 1000) / 3600; // ~6.94 m/s (25 km/h)
          let accumulatedDist = minDistance;
          for (let s = nearestIdx + 1; s < primaryStops.length; s++) {
            const prevStop = primaryStops[s - 1]!;
            const currStop = primaryStops[s]!;
            accumulatedDist += haversineDistanceMeters(prevStop.lat, prevStop.lon, currStop.lat, currStop.lon);
            const eta = Math.round(accumulatedDist / AVG_SPEED_MS);
            if (!currStop.etaSeconds || eta < currStop.etaSeconds) {
              currStop.etaSeconds = eta;
              currStop.freshness = freshness;
            }
          }
        }

        vehicles.push({
          tripId: vc.tripId,
          routeId: vc.routeId,
          lat: vc.lat,
          lon: vc.lon,
          bearing: vc.bearing,
          timestamp: vc.timestamp,
          freshness,
          nearestStopId,
          nextStopId,
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
         JOIN calendar c ON c.feed_id = t.feed_id AND c.service_id = t.service_id
         JOIN stop_times st ON st.feed_id = t.feed_id AND st.trip_id = t.trip_id
         WHERE t.route_id = $1
           AND t.feed_id = $2
           AND c.${dayOfWeek} = 1
           AND c.start_date <= CURRENT_DATE
           AND c.end_date >= CURRENT_DATE
         ORDER BY t.trip_id, st.stop_sequence ASC`,
        [routeId, feedId],
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
      shapes: primaryShapes,
      stops: primaryStops,
      vehicles,
      timetable,
    };

    res.json(response);
  } catch (err) {
    console.error(`[api/routes] Error for routeId=${routeId}:`, err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /api/routes/:routeId/timetable ─────────────────────────────────────────
// Returns full timetable departures for a route, optionally filtered by stopId and directionId.
routesRouter.get('/routes/:routeId/timetable', async (req, res) => {
  const pool = req.app.locals['pool'] as Pool;
  const { routeId } = req.params;
  const { stopId, directionId: dirStr } = req.query;
  const feedId = (req.query.feedId as string | undefined) || 'rapid-bus-kl';
  const directionId = dirStr !== undefined ? parseInt(String(dirStr), 10) : undefined;

  try {
    const nowKL = nowInKL();
    const dayOfWeek = nowKL.dayOfWeek;
    const secondsSinceMidnight = nowKL.secondsSinceMidnight;

    let query = `
      SELECT t.trip_id, t.direction_id, t.trip_headsign, st.departure_time, st.arrival_time, st.stop_sequence, s.stop_id, s.stop_name
      FROM trips t
      JOIN calendar c ON c.feed_id = t.feed_id AND c.service_id = t.service_id
      JOIN stop_times st ON st.feed_id = t.feed_id AND st.trip_id = t.trip_id
      JOIN stops s ON s.feed_id = st.feed_id AND s.stop_id = st.stop_id
      WHERE t.route_id = $1
        AND t.feed_id = $2
        AND c.${dayOfWeek} = 1
        AND c.start_date <= CURRENT_DATE
        AND c.end_date >= CURRENT_DATE
    `;
    const params: unknown[] = [routeId, feedId];

    if (stopId && typeof stopId === 'string') {
      params.push(stopId);
      query += ` AND st.stop_id = $${params.length}`;
    } else {
      // Default to origin departure (min stop_sequence per trip)
      query += ` AND st.stop_sequence = (
        SELECT MIN(st2.stop_sequence) FROM stop_times st2 WHERE st2.feed_id = t.feed_id AND st2.trip_id = t.trip_id
      )`;
    }

    if (directionId !== undefined && !isNaN(directionId)) {
      params.push(directionId);
      query += ` AND t.direction_id = $${params.length}`;
    }

    query += ` ORDER BY st.departure_time ASC`;

    const result = await pool.query<{
      trip_id: string;
      direction_id: number;
      trip_headsign: string;
      departure_time: string;
      arrival_time: string;
      stop_sequence: number;
      stop_id: string;
      stop_name: string;
    }>(query, params);

    const departures: RouteScheduledDeparture[] = result.rows.map((r) => ({
      tripId: r.trip_id,
      departureTime: r.departure_time || r.arrival_time,
      tripHeadsign: r.trip_headsign,
      directionId: r.direction_id,
    }));

    const nextDepartures = departures.filter((d) => {
      try {
        return parseGtfsTime(d.departureTime) >= secondsSinceMidnight;
      } catch {
        return true;
      }
    });

    const response: RouteTimetable = {
      firstBusTime: departures[0]?.departureTime ?? null,
      lastBusTime: departures[departures.length - 1]?.departureTime ?? null,
      totalTripsToday: departures.length,
      nextDepartures,
      allDepartures: departures,
    };

    res.json(response);
  } catch (err) {
    console.error(`[api/routes] Error fetching timetable for routeId=${routeId}:`, err);
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
