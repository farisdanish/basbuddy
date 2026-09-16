/**
 * Geometric distance utilities for off-course deviation detection.
 */

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculates minimum distance in meters from a point (pLat, pLon) to a line segment [a -> b].
 * Uses equirectangular flat-Earth projection which is extremely fast and accurate over transit scales (< 5km).
 */
export function distanceToSegmentMeters(
  pLat: number,
  pLon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const midLatRad = toRad((aLat + bLat) / 2);
  const cosMidLat = Math.cos(midLatRad);

  // Convert (lat, lon) to meters relative to A
  const R = 6371000;
  const ax = 0;
  const ay = 0;
  const bx = toRad(bLon - aLon) * R * cosMidLat;
  const by = toRad(bLat - aLat) * R;
  const px = toRad(pLon - aLon) * R * cosMidLat;
  const py = toRad(pLat - aLat) * R;

  const dx = bx - ax;
  const dy = by - ay;
  const segLenSq = dx * dx + dy * dy;

  if (segLenSq === 0) {
    return Math.sqrt(px * px + py * py);
  }

  // Project point onto line segment, clamped between [0, 1]
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / segLenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;

  const distX = px - projX;
  const distY = py - projY;
  return Math.sqrt(distX * distX + distY * distY);
}

/**
 * Calculates the minimum distance in meters from a vehicle point to any segment in a polyline.
 */
export function minDistanceToPolylineMeters(
  lat: number,
  lon: number,
  points?: Array<[number, number]> | null,
): number {
  if (!points || points.length === 0) return 0;
  if (points.length === 1) {
    const pt = points[0]!;
    return haversineMeters(lat, lon, pt[0], pt[1]);
  }

  let minDistance = Infinity;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dist = distanceToSegmentMeters(lat, lon, a[0], a[1], b[0], b[1]);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance;
}

/**
 * Flags whether a vehicle has deviated off course from the route shape.
 * Default threshold is 200 meters.
 */
export function isVehicleOffCourse(
  lat: number,
  lon: number,
  shapePoints?: Array<[number, number]> | null,
  thresholdMeters = 200,
): boolean {
  if (!shapePoints || shapePoints.length === 0) return false;
  const minDistance = minDistanceToPolylineMeters(lat, lon, shapePoints);
  return minDistance > thresholdMeters;
}
