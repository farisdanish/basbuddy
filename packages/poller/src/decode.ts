import { transit_realtime } from 'gtfs-realtime-bindings';
import type { VehiclePositionCache } from '@basbuddy/shared';

// ─── Bounding box for RapidKL coverage area ───────────────────────────────────
// Positions outside this box are treated as bad GPS readings and dropped (§9).
// Configurable via env vars so you can tighten/widen without a code change.

const BOUNDS = {
  latMin: parseFloat(process.env.BOUNDS_LAT_MIN ?? '2.5'),
  latMax: parseFloat(process.env.BOUNDS_LAT_MAX ?? '3.5'),
  lonMin: parseFloat(process.env.BOUNDS_LON_MIN ?? '101.2'),
  lonMax: parseFloat(process.env.BOUNDS_LON_MAX ?? '102.0'),
};

/**
 * Raw vehicle entity decoded from protobuf — before enrichment with static data.
 */
export interface RawVehicleEntity {
  tripId: string | null;
  routeId: string | null;
  lat: number;
  lon: number;
  bearing: number | null;
  /** Unix timestamp from the GTFS-RT entity itself. */
  gtfsTimestamp: number | null;
}

/**
 * Decodes a GTFS-RT protobuf buffer into an array of vehicle position entities.
 * Drops entities that:
 *  - have no position (lat/lon both 0 is treated as "no position")
 *  - fall outside the RapidKL coverage bounding box (bad GPS guard, §9)
 */
export function decodeRealtimeFeed(buffer: Buffer): RawVehicleEntity[] {
  const feed = transit_realtime.FeedMessage.decode(buffer);
  const results: RawVehicleEntity[] = [];
  let droppedOutOfBounds = 0;
  let droppedNoPosition = 0;

  for (const entity of feed.entity) {
    const vp = entity.vehicle;
    if (!vp) continue;

    const pos = vp.position;
    if (!pos || (pos.latitude === 0 && pos.longitude === 0)) {
      droppedNoPosition++;
      continue;
    }

    const lat = pos.latitude;
    const lon = pos.longitude;

    // Bounds filter — flag bad GPS rather than crash (§9)
    if (lat < BOUNDS.latMin || lat > BOUNDS.latMax || lon < BOUNDS.lonMin || lon > BOUNDS.lonMax) {
      droppedOutOfBounds++;
      console.warn(
        `[decode] Out-of-bounds position dropped: tripId=${vp.trip?.tripId ?? 'unknown'} lat=${lat} lon=${lon}`,
      );
      continue;
    }

    results.push({
      tripId: vp.trip?.tripId ?? null,
      routeId: vp.trip?.routeId ?? null,
      lat,
      lon,
      bearing: pos.bearing ?? null,
      gtfsTimestamp:
        typeof vp.timestamp === 'number'
          ? vp.timestamp
          : vp.timestamp && typeof (vp.timestamp as { toNumber?: () => number }).toNumber === 'function'
            ? (vp.timestamp as { toNumber: () => number }).toNumber()
            : null,
    });
  }

  console.log(
    `[decode] Decoded ${results.length} valid entities ` +
      `(dropped: ${droppedOutOfBounds} out-of-bounds, ${droppedNoPosition} no-position)`,
  );

  return results;
}
