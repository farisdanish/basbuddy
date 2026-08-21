import type { RawVehicleEntity } from './decode.js';
import type { StaticLookup } from './staticLookup.js';

// ─── Bearing disambiguation threshold ────────────────────────────────────────
// If a fallback-matched vehicle's bearing differs from the shape segment's
// bearing by more than this angle, we reject the snap (wrong direction).
// ~150° means "roughly opposite" — accounts for GPS jitter.
const BEARING_REJECTION_THRESHOLD_DEG = 150;

interface MatchResult {
  tripId: string;
  routeId: string;
  directionId: number;
  shapeId: string;
  headsign: string;
}

/**
 * Matches a raw GTFS-RT vehicle entity to a trip in the static lookup.
 *
 * Primary path: trip_id is present → direct lookup (§9, common case).
 * Fallback path: trip_id absent → match by route + nearest shape,
 *                bearing-disambiguated to reject wrong-direction snaps.
 *
 * Returns null if no match can be made.
 */
export function matchVehicle(
  entity: RawVehicleEntity,
  lookup: StaticLookup,
): MatchResult | null {
  // ── Primary: trip_id present ───────────────────────────────────────────────
  if (entity.tripId) {
    const trip = lookup.trips.get(entity.tripId);
    if (!trip) {
      // Known data gap: ~2% of rapid-bus-kl trips are missing from stop_times/trips.
      // Skip silently rather than crashing (§14 open question).
      return null;
    }
    return {
      tripId: entity.tripId,
      routeId: trip.routeId,
      directionId: trip.directionId,
      shapeId: trip.shapeId,
      headsign: trip.headsign,
    };
  }

  // ── Fallback: no trip_id ──────────────────────────────────────────────────
  if (!entity.routeId) {
    // Can't match without at least a route_id
    return null;
  }

  // Find all trips for this route
  const candidateTrips: Array<{ tripId: string; shapeId: string; directionId: number; routeId: string; headsign: string }> = [];
  for (const [tripId, trip] of lookup.trips) {
    if (trip.routeId === entity.routeId) {
      candidateTrips.push({ tripId, shapeId: trip.shapeId, directionId: trip.directionId, routeId: trip.routeId, headsign: trip.headsign });
    }
  }

  if (candidateTrips.length === 0) return null;

  // Find the trip whose shape the vehicle snaps to most closely
  let bestCandidate: (typeof candidateTrips)[0] | null = null;
  let bestDist = Infinity;

  for (const candidate of candidateTrips) {
    const points = lookup.shapes.get(candidate.shapeId);
    if (!points || points.length < 2) continue;

    const dist = minDistanceToPolyline(entity.lat, entity.lon, points);

    // Bearing disambiguation: if vehicle bearing is known and roughly opposite
    // to the segment it's nearest to, skip this candidate (§9 fallback path)
    if (entity.bearing !== null) {
      const nearestBearing = nearestSegmentBearing(entity.lat, entity.lon, points);
      const angleDiff = Math.abs(angleDifference(entity.bearing, nearestBearing));
      if (angleDiff > BEARING_REJECTION_THRESHOLD_DEG) {
        continue;
      }
    }

    if (dist < bestDist) {
      bestDist = dist;
      bestCandidate = candidate;
    }
  }

  if (!bestCandidate) return null;

  // Use the routeId from the matched trip (more reliable than entity.routeId)
  return {
    tripId: `fallback_${entity.routeId}_${entity.lat.toFixed(4)}_${entity.lon.toFixed(4)}`,
    routeId: bestCandidate.routeId,
    directionId: bestCandidate.directionId,
    shapeId: bestCandidate.shapeId,
    headsign: bestCandidate.headsign,
  };
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function minDistanceToPolyline(lat: number, lon: number, points: { lat: number; lon: number }[]): number {
  let minDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distanceToSegment(lat, lon, points[i]!.lat, points[i]!.lon, points[i + 1]!.lat, points[i + 1]!.lon);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function distanceToSegment(pLat: number, pLon: number, p1Lat: number, p1Lon: number, p2Lat: number, p2Lon: number): number {
  const dx = p2Lon - p1Lon;
  const dy = p2Lat - p1Lat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const dLat = pLat - p1Lat;
    const dLon = pLon - p1Lon;
    return Math.sqrt(dLat * dLat + dLon * dLon) * 111_320;
  }
  const t = Math.max(0, Math.min(1, ((pLon - p1Lon) * dx + (pLat - p1Lat) * dy) / lenSq));
  const projLat = p1Lat + t * dy;
  const projLon = p1Lon + t * dx;
  const dLat = pLat - projLat;
  const dLon = pLon - projLon;
  // Approximate: 1 degree ≈ 111_320m at equator, good enough for bearing disambiguation
  return Math.sqrt((dLat * 111_320) ** 2 + (dLon * 111_320 * Math.cos((pLat * Math.PI) / 180)) ** 2);
}

function nearestSegmentBearing(lat: number, lon: number, points: { lat: number; lon: number }[]): number {
  let minDist = Infinity;
  let bearing = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distanceToSegment(lat, lon, points[i]!.lat, points[i]!.lon, points[i + 1]!.lat, points[i + 1]!.lon);
    if (d < minDist) {
      minDist = d;
      bearing = segmentBearing(points[i]!.lat, points[i]!.lon, points[i + 1]!.lat, points[i + 1]!.lon);
    }
  }
  return bearing;
}

function segmentBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLon = toRad(lon2 - lon1);
  const lat1r = toRad(lat1);
  const lat2r = toRad(lat2);
  const y = Math.sin(dLon) * Math.cos(lat2r);
  const x = Math.cos(lat1r) * Math.sin(lat2r) - Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Smallest angle between two bearings (0–180). */
function angleDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}
