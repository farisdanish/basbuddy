import type { RouteStopItem } from '@basbuddy/shared';

/**
 * Filter route stops by name or stop ID (case-insensitive)
 */
export function filterRouteStops(stops: RouteStopItem[], query: string): RouteStopItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return stops;

  return stops.filter((stop) => {
    const nameMatch = stop.stopName?.toLowerCase().includes(trimmed) ?? false;
    const idMatch = stop.stopId.toLowerCase().includes(trimmed);
    return nameMatch || idMatch;
  });
}
