import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import { fetchRealtimeFeed } from './fetch.js';
import { decodeRealtimeFeed } from './decode.js';
import { matchVehicle } from './matcher.js';
import { computeEta } from './eta.js';
import type { StaticLookup } from './staticLookup.js';
import {
  VALKEY_KEYS,
  VEHICLE_TTL_SECONDS,
  type VehiclePositionCache,
  type StopArrival,
  type StopEtasResponse,
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
  const buffer = await fetchRealtimeFeed(url);

  // ── 2. Decode + filter ────────────────────────────────────────────────────────
  const entities = decodeRealtimeFeed(buffer);

  // ── 3 & 4. Match + ETA ───────────────────────────────────────────────────────
  const vehicleCaches: VehiclePositionCache[] = [];
  // stopArrivals: stopId → list of arrivals
  const stopArrivalsMap = new Map<string, StopArrival[]>();

  const generatedAt = new Date().toISOString();

  for (const entity of entities) {
    const matched = matchVehicle(entity, staticLookup);
    if (!matched) continue;

    const { tripId, routeId, directionId, shapeId, headsign } = matched;

    const vehicleCache: VehiclePositionCache = {
      tripId,
      routeId,
      directionId,
      lat: entity.lat,
      lon: entity.lon,
      bearing: entity.bearing,
      timestamp: entity.gtfsTimestamp
        ? new Date(entity.gtfsTimestamp * 1000).toISOString()
        : generatedAt,
    };
    vehicleCaches.push(vehicleCache);

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
      stopArrivalsMap.get(stopId)!.push({
        tripId,
        routeId,
        routeShortName: routeId, // TODO: enrich with route.route_short_name from a routes map
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

    const etasResponse: StopEtasResponse = {
      stopId,
      stopName: '', // TODO: enrich from a stops map loaded at startup
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

  await pipeline.exec();

  const elapsed = Date.now() - cycleStart;
  console.log(
    `[cycle ${cycleNumber}] ✓ Wrote ${vehicleCaches.length} vehicles, ` +
      `${stopArrivalsMap.size} stops, ` +
      `${routeVehicleMap.size} routes in ${elapsed}ms`,
  );
}
