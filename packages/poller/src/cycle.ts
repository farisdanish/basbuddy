import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import { fetchRealtimeFeed } from './fetch.js';
import { decodeRealtimeFeed, type RawVehicleEntity } from './decode.js';
import { matchVehicle } from './matcher.js';
import { computeEta } from './eta.js';
import {
  type StaticLookup,
  projectPointToPolylineDistance,
  pointAtPolylineDistance,
} from './staticLookup.js';
import {
  VALKEY_KEYS,
  VEHICLE_TTL_SECONDS,
  type VehiclePositionCache,
  type StopArrival,
  type StopEtasResponse,
  type UpstreamHealthInfo,
} from '@basbuddy/shared';

// Lookahead window for ETA — only include trips arriving within this many seconds.
const ETA_LOOKAHEAD_SECONDS = 3600; // 1 hour

interface CycleOptions {
  cycleNumber: number;
  url: string;
  valkey: Redis;
  pool: Pool;
  staticLookup: StaticLookup;
}

export interface TrackedVehicleState {
  tripId: string;
  routeId: string;
  directionId: number;
  shapeId: string;
  headsign: string;
  lat: number;
  lon: number;
  bearing: number | null;
  speedKmh: number;
  lastObservedAt: number;
  lastExtrapolatedAt?: number;
  consecutiveMisses: number;
}

// In-memory tracking map for single-instance poller dead-reckoning
export const trackedVehiclesMap = new Map<string, TrackedVehicleState>();

/**
 * A single poll cycle:
 * 1. Fetch GTFS-RT protobuf
 * 2. Decode + bounds-filter
 * 3. Match each entity to a trip/shape
 * 4. Compute ETAs per stop
 * 5. Write all results to Valkey
 *
 * Any error propagates up — the caller (poller.ts) catches and logs it,
 * then schedules the next cycle regardless.
 */
export async function runPollCycle(opts: CycleOptions): Promise<void> {
  const { cycleNumber, url, valkey, staticLookup } = opts;
  const cycleStart = Date.now();
  console.log(`\n[cycle ${cycleNumber}] Starting at ${new Date().toISOString()}`);

  // ── 1. Fetch ─────────────────────────────────────────────────────────────────
  const { buffer, latencyMs, httpStatus } = await fetchRealtimeFeed(url);

  // ── 2. Decode + filter ────────────────────────────────────────────────────────
  const entities = decodeRealtimeFeed(buffer);

  // ── 3 & 4. Match + ETA ───────────────────────────────────────────────────────
  const vehicleCaches: VehiclePositionCache[] = [];
  // stopArrivals: stopId → list of arrivals
  const stopArrivalsMap = new Map<string, StopArrival[]>();

  const generatedAt = new Date().toISOString();
  const currentObservedTrips = new Set<string>();

  for (const entity of entities) {
    const matched = matchVehicle(entity, staticLookup);
    if (!matched) continue;

    const { tripId, routeId, directionId, shapeId, headsign } = matched;
    currentObservedTrips.add(tripId);

    const vehicleCache: VehiclePositionCache = {
      tripId,
      routeId,
      directionId,
      lat: entity.lat,
      lon: entity.lon,
      bearing: entity.bearing,
      speedKmh: entity.speedKmh,
      timestamp: entity.gtfsTimestamp
        ? new Date(entity.gtfsTimestamp * 1000).toISOString()
        : generatedAt,
      isExtrapolated: false,
    };
    vehicleCaches.push(vehicleCache);

    // Save/update tracked state for dead-reckoning recovery
    trackedVehiclesMap.set(tripId, {
      tripId,
      routeId,
      directionId,
      shapeId,
      headsign,
      lat: entity.lat,
      lon: entity.lon,
      bearing: entity.bearing,
      speedKmh: entity.speedKmh && entity.speedKmh > 0 ? entity.speedKmh : 25,
      lastObservedAt: cycleStart,
      consecutiveMisses: 0,
    });

    // Compute ETAs for each upcoming stop on this trip
    const etasByStop = computeEta({
      entity,
      shapeId,
      tripId,
      routeId,
      headsign,
      staticLookup,
      lookaheadSeconds: ETA_LOOKAHEAD_SECONDS,
    });

    for (const [stopId, etaSeconds] of etasByStop) {
      if (!stopArrivalsMap.has(stopId)) {
        stopArrivalsMap.set(stopId, []);
      }
      const routeShortName =
        staticLookup.routes.get(routeId)?.routeShortName || routeId;

      stopArrivalsMap.get(stopId)!.push({
        tripId,
        routeId,
        routeShortName,
        tripHeadsign: headsign,
        etaSeconds,
        source: 'live',
        freshness: 'live',
        vehicle: {
          lat: entity.lat,
          lon: entity.lon,
          bearing: entity.bearing,
        },
      });
    }
  }

  // ── 3b. Dead-Reckoning Extrapolation (Task D1) ──────────────────────────────
  // For vehicles observed recently (<= 60s / 1-2 missed cycles) that temporarily
  // dropped from the feed, extrapolate their position along the route shape.
  const AVG_SPEED_MS = (25 * 1000) / 3600; // 25 km/h fallback in m/s

  for (const [tripId, tracked] of trackedVehiclesMap) {
    if (currentObservedTrips.has(tripId)) {
      continue; // actively observed in this cycle
    }

    const missingDurationMs = cycleStart - tracked.lastObservedAt;
    if (missingDurationMs > 60_000 || tracked.consecutiveMisses >= 2) {
      // Exceeded extrapolation window — vehicle genuinely completed or vanished
      trackedVehiclesMap.delete(tripId);
      continue;
    }

    const shapePoints = staticLookup.shapes.get(tracked.shapeId);
    const shapeCumDist = staticLookup.shapeCumulativeDistances.get(tracked.shapeId);

    if (!shapePoints || !shapeCumDist) {
      trackedVehiclesMap.delete(tripId);
      continue;
    }

    // Project previous position onto shape
    const currentDistAlong = projectPointToPolylineDistance(
      tracked.lat,
      tracked.lon,
      shapePoints,
      shapeCumDist,
    );

    const speedMs = (tracked.speedKmh * 1000) / 3600 || AVG_SPEED_MS;
    const lastTimestamp = tracked.lastExtrapolatedAt ?? tracked.lastObservedAt;
    const deltaSeconds = Math.max(1, (cycleStart - lastTimestamp) / 1000);
    const extrapolatedDistAlong = currentDistAlong + speedMs * deltaSeconds;

    const projected = pointAtPolylineDistance(
      extrapolatedDistAlong,
      shapePoints,
      shapeCumDist,
    );

    if (!projected) {
      // Vehicle reached or passed the end of the shape
      trackedVehiclesMap.delete(tripId);
      continue;
    }

    // Update tracked state
    tracked.lat = projected.lat;
    tracked.lon = projected.lon;
    tracked.bearing = projected.bearing;
    tracked.lastExtrapolatedAt = cycleStart;
    tracked.consecutiveMisses += 1;

    // Add extrapolated vehicle cache
    const extrapolatedCache: VehiclePositionCache = {
      tripId: tracked.tripId,
      routeId: tracked.routeId,
      directionId: tracked.directionId,
      lat: projected.lat,
      lon: projected.lon,
      bearing: projected.bearing,
      speedKmh: tracked.speedKmh,
      timestamp: new Date(tracked.lastObservedAt).toISOString(),
      isExtrapolated: true,
    };
    vehicleCaches.push(extrapolatedCache);

    // Compute ETAs from extrapolated position so stop arrivals stay live with freshness: 'estimated'
    const extrapolatedEntity: RawVehicleEntity = {
      tripId: tracked.tripId,
      routeId: tracked.routeId,
      lat: projected.lat,
      lon: projected.lon,
      bearing: projected.bearing,
      speedKmh: tracked.speedKmh,
      gtfsTimestamp: Math.floor(tracked.lastObservedAt / 1000),
    };

    const etasByStop = computeEta({
      entity: extrapolatedEntity,
      shapeId: tracked.shapeId,
      tripId: tracked.tripId,
      routeId: tracked.routeId,
      headsign: tracked.headsign,
      staticLookup,
      lookaheadSeconds: ETA_LOOKAHEAD_SECONDS,
    });

    for (const [stopId, etaSeconds] of etasByStop) {
      if (!stopArrivalsMap.has(stopId)) {
        stopArrivalsMap.set(stopId, []);
      }
      const routeShortName =
        staticLookup.routes.get(tracked.routeId)?.routeShortName || tracked.routeId;

      stopArrivalsMap.get(stopId)!.push({
        tripId: tracked.tripId,
        routeId: tracked.routeId,
        routeShortName,
        tripHeadsign: tracked.headsign,
        etaSeconds,
        source: 'live',
        freshness: 'estimated',
        vehicle: {
          lat: projected.lat,
          lon: projected.lon,
          bearing: projected.bearing,
        },
      });
    }
  }

  // ── 5. Write to Valkey ────────────────────────────────────────────────────────
  const pipeline = valkey.pipeline();

  // vehicle:{tripId} keys
  for (const vc of vehicleCaches) {
    pipeline.set(
      VALKEY_KEYS.vehicle(vc.tripId),
      JSON.stringify(vc),
      'EX',
      VEHICLE_TTL_SECONDS,
    );
  }

  // route:{routeId}:vehicles SET keys
  const routeVehicleMap = new Map<string, string[]>();
  for (const vc of vehicleCaches) {
    if (!routeVehicleMap.has(vc.routeId)) routeVehicleMap.set(vc.routeId, []);
    routeVehicleMap.get(vc.routeId)!.push(vc.tripId);
  }
  for (const [routeId, tripIds] of routeVehicleMap) {
    const key = VALKEY_KEYS.routeVehicles(routeId);
    pipeline.del(key); // clear stale entries from previous cycle
    if (tripIds.length > 0) {
      pipeline.sadd(key, ...tripIds);
      pipeline.expire(key, VEHICLE_TTL_SECONDS);
    }
  }

  // stop_etas:{stopId} keys
  for (const [stopId, arrivals] of stopArrivalsMap) {
    // Sort ascending by ETA
    arrivals.sort((a, b) => a.etaSeconds - b.etaSeconds);

    const stopInfo = staticLookup.stops.get(stopId);
    const stopName = stopInfo?.stopName || stopId;

    const etasResponse: StopEtasResponse = {
      stopId,
      stopName,
      generatedAt,
      arrivals,
    };
    pipeline.set(
      VALKEY_KEYS.stopEtas(stopId),
      JSON.stringify(etasResponse),
      'EX',
      VEHICLE_TTL_SECONDS,
    );
  }

  // Record data.gov.my upstream telemetry & health
  const upstreamHealth: UpstreamHealthInfo = {
    status: 'operational',
    httpStatus,
    responseTimeMs: latencyMs,
    feedTimestamp: generatedAt,
    lastSuccessAt: generatedAt,
    lastAttemptAt: generatedAt,
    activeVehiclesCount: entities.length,
    matchedVehiclesCount: vehicleCaches.length,
    feedUrl: url,
    lastError: null,
  };
  pipeline.set(VALKEY_KEYS.upstreamHealth, JSON.stringify(upstreamHealth));

  await pipeline.exec();

  const elapsed = Date.now() - cycleStart;
  console.log(
    `[cycle ${cycleNumber}] ✓ Wrote ${vehicleCaches.length} vehicles, ` +
      `${stopArrivalsMap.size} stops, ` +
      `${routeVehicleMap.size} routes in ${elapsed}ms`,
  );
}
