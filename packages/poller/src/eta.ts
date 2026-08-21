import type { RawVehicleEntity } from './decode.js';
import type { StaticLookup } from './staticLookup.js';
import { projectPointToPolylineDistance } from './staticLookup.js';

// ─── ETA Engine (v1 — naive distance / assumed speed) ─────────────────────────
// §9: "Estimate ETA using a simple average speed (distance remaining ÷ assumed km/h),
// not the static schedule alone."
//
// This is intentionally cheap. No historical speed modeling in v1.
// It'll drift under heavy traffic — that's an accepted limitation, not a bug.
// The AVG_SPEED_KMH constant is tunable via env var.

const AVG_SPEED_KMH = parseFloat(process.env.AVG_SPEED_KMH ?? '25');
const AVG_SPEED_MS = (AVG_SPEED_KMH * 1000) / 3600; // m/s

interface EtaOptions {
  entity: RawVehicleEntity;
  shapeId: string;
  tripId: string;
  routeId: string;
  headsign: string;
  staticLookup: StaticLookup;
  lookaheadSeconds: number;
}

/**
 * Computes ETAs (seconds from now) for each upcoming stop on the trip's shape.
 *
 * Returns a Map<stopId, etaSeconds> for stops that are:
 *  - ahead of the vehicle on the route (positive distance remaining)
 *  - within the lookahead window
 */
export function computeEta(opts: EtaOptions): Map<string, number> {
  const { entity, shapeId, staticLookup, lookaheadSeconds } = opts;

  const points = staticLookup.shapes.get(shapeId);
  const cumDist = staticLookup.shapeCumulativeDistances.get(shapeId);
  const stopDistances = staticLookup.stopShapeDistances.get(shapeId);

  if (!points || !cumDist || !stopDistances) return new Map();

  // Project vehicle position onto shape → get "how far along the route is the bus"
  const vehicleDistAlong = projectPointToPolylineDistance(entity.lat, entity.lon, points, cumDist);

  const result = new Map<string, number>();

  for (const [stopId, stopDistAlong] of stopDistances) {
    const distRemaining = stopDistAlong - vehicleDistAlong;
    if (distRemaining <= 0) continue; // stop is behind the vehicle

    const etaSeconds = distRemaining / AVG_SPEED_MS;
    if (etaSeconds > lookaheadSeconds) continue; // too far ahead

    result.set(stopId, Math.round(etaSeconds));
  }

  return result;
}
