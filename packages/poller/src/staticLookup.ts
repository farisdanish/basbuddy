import type { Pool } from 'pg';

// ─── StaticLookup ─────────────────────────────────────────────────────────────
// In-memory lookup tables loaded from Postgres at poller startup.
// Avoids a DB round-trip per vehicle per poll cycle (§4 M2 checklist).
// Refresh by restarting the poller after running the ingestion script.

export interface ShapePoint {
  lat: number;
  lon: number;
  sequence: number;
}

export interface TripInfo {
  routeId: string;
  directionId: number;
  shapeId: string;
  headsign: string;
}

export interface StaticLookup {
  /** Map from trip_id → TripInfo */
  trips: Map<string, TripInfo>;
  /** Map from shape_id → ShapePoint[] (sorted ascending by sequence) */
  shapes: Map<string, ShapePoint[]>;
  /** Map from shape_id → cumulative distances in meters, parallel to shapes[shape_id] */
  shapeCumulativeDistances: Map<string, number[]>;
  /** Map from (trip_id + '|' + stop_id) → stop_sequence (for stop position lookup) */
  stopSequences: Map<string, number>;
  /** Map from (trip_id + '|' + stop_sequence) → stop_id */
  stopAtSequence: Map<string, string>;
  /** Map from shape_id → map from stop_id → projected distance along shape (meters) */
  stopShapeDistances: Map<string, Map<string, number>>;
  /** Diagnostics */
  tripCount: number;
  shapeCount: number;
}

/**
 * Loads trips and shapes from Postgres into memory.
 * This is a one-time startup cost — typically a few seconds for a full feed.
 */
export async function loadStaticLookup(pool: Pool): Promise<StaticLookup> {
  const trips = new Map<string, TripInfo>();
  const shapes = new Map<string, ShapePoint[]>();
  const shapeCumulativeDistances = new Map<string, number[]>();
  const stopSequences = new Map<string, number>();
  const stopAtSequence = new Map<string, string>();
  const stopShapeDistances = new Map<string, Map<string, number>>();

  // ── Load trips ─────────────────────────────────────────────────────────────
  const tripsResult = await pool.query<{
    trip_id: string;
    route_id: string;
    direction_id: number;
    shape_id: string;
    trip_headsign: string;
  }>('SELECT trip_id, route_id, direction_id, shape_id, trip_headsign FROM trips');

  for (const row of tripsResult.rows) {
    trips.set(row.trip_id, {
      routeId: row.route_id,
      directionId: row.direction_id,
      shapeId: row.shape_id,
      headsign: row.trip_headsign,
    });
  }

  // ── Load shapes ────────────────────────────────────────────────────────────
  const shapesResult = await pool.query<{
    shape_id: string;
    shape_pt_lat: number;
    shape_pt_lon: number;
    shape_pt_sequence: number;
  }>('SELECT shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence FROM shapes ORDER BY shape_id, shape_pt_sequence ASC');

  for (const row of shapesResult.rows) {
    if (!shapes.has(row.shape_id)) {
      shapes.set(row.shape_id, []);
    }
    shapes.get(row.shape_id)!.push({
      lat: row.shape_pt_lat,
      lon: row.shape_pt_lon,
      sequence: row.shape_pt_sequence,
    });
  }

  // ── Pre-compute cumulative distances for each shape ─────────────────────────
  for (const [shapeId, points] of shapes) {
    const distances: number[] = [0];
    for (let i = 1; i < points.length; i++) {
      const d = haversineMeters(
        points[i - 1]!.lat,
        points[i - 1]!.lon,
        points[i]!.lat,
        points[i]!.lon,
      );
      distances.push(distances[i - 1]! + d);
    }
    shapeCumulativeDistances.set(shapeId, distances);
  }

  // ── Load stop_times for stop-shape distance mapping ────────────────────────
  // We load all stop_times to be able to project each stop onto its shape.
  // This lets the ETA engine know how far along the route each stop is.
  const stopTimesResult = await pool.query<{
    trip_id: string;
    stop_id: string;
    stop_sequence: number;
  }>('SELECT trip_id, stop_id, stop_sequence FROM stop_times');

  for (const row of stopTimesResult.rows) {
    stopSequences.set(`${row.trip_id}|${row.stop_id}`, row.stop_sequence);
    stopAtSequence.set(`${row.trip_id}|${row.stop_sequence}`, row.stop_id);
  }

  // ── Pre-compute stop distances along each shape ────────────────────────────
  // For each trip, project each stop's lat/lon onto the shape polyline.
  const stopsResult = await pool.query<{
    stop_id: string;
    stop_lat: number;
    stop_lon: number;
  }>('SELECT stop_id, stop_lat, stop_lon FROM stops');

  const stopCoords = new Map<string, { lat: number; lon: number }>();
  for (const row of stopsResult.rows) {
    stopCoords.set(row.stop_id, { lat: row.stop_lat, lon: row.stop_lon });
  }

  // Build shape_id → stop_id → projected distance map
  // We iterate over trips to know which stops belong to which shape
  const tripStops = new Map<string, { stopId: string; seq: number }[]>();
  for (const [key, seq] of stopSequences) {
    const [tripId, stopId] = key.split('|') as [string, string];
    if (!tripStops.has(tripId)) tripStops.set(tripId, []);
    tripStops.get(tripId)!.push({ stopId, seq });
  }

  for (const [tripId, stops] of tripStops) {
    const trip = trips.get(tripId);
    if (!trip) continue;
    const { shapeId } = trip;
    const points = shapes.get(shapeId);
    const cumDist = shapeCumulativeDistances.get(shapeId);
    if (!points || !cumDist) continue;

    if (!stopShapeDistances.has(shapeId)) {
      stopShapeDistances.set(shapeId, new Map());
    }
    const shapeStopMap = stopShapeDistances.get(shapeId)!;

    for (const { stopId } of stops) {
      if (shapeStopMap.has(stopId)) continue; // already computed for this shape
      const coords = stopCoords.get(stopId);
      if (!coords) continue;
      const projDist = projectPointToPolylineDistance(coords.lat, coords.lon, points, cumDist);
      shapeStopMap.set(stopId, projDist);
    }
  }

  return {
    trips,
    shapes,
    shapeCumulativeDistances,
    stopSequences,
    stopAtSequence,
    stopShapeDistances,
    tripCount: trips.size,
    shapeCount: shapes.size,
  };
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

/**
 * Haversine distance between two lat/lon points in meters.
 */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Projects a point (lat, lon) onto a polyline and returns the cumulative
 * distance along the polyline to the closest projected point (in meters).
 *
 * Used to find "how far along the route is this vehicle / stop?"
 */
export function projectPointToPolylineDistance(
  lat: number,
  lon: number,
  points: ShapePoint[],
  cumDist: number[],
): number {
  if (points.length === 0) return 0;
  if (points.length === 1) return 0;

  let bestDist = Infinity;
  let bestProjectedCumDist = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]!;
    const p2 = points[i + 1]!;

    const { t, projLat, projLon } = closestPointOnSegment(lat, lon, p1.lat, p1.lon, p2.lat, p2.lon);
    const dist = haversineMeters(lat, lon, projLat, projLon);

    if (dist < bestDist) {
      bestDist = dist;
      const segLen = cumDist[i + 1]! - cumDist[i]!;
      bestProjectedCumDist = cumDist[i]! + t * segLen;
    }
  }

  return bestProjectedCumDist;
}

/**
 * Returns the closest point on a line segment [p1→p2] to point p,
 * expressed as a parameter t ∈ [0,1] and the projected lat/lon.
 */
function closestPointOnSegment(
  pLat: number, pLon: number,
  p1Lat: number, p1Lon: number,
  p2Lat: number, p2Lon: number,
): { t: number; projLat: number; projLon: number } {
  const dx = p2Lon - p1Lon;
  const dy = p2Lat - p1Lat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return { t: 0, projLat: p1Lat, projLon: p1Lon };

  const t = Math.max(0, Math.min(1, ((pLon - p1Lon) * dx + (pLat - p1Lat) * dy) / lenSq));
  return {
    t,
    projLat: p1Lat + t * dy,
    projLon: p1Lon + t * dx,
  };
}
