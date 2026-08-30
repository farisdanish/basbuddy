import type { RouteDirection, RouteStopItem, LiveVehicle } from '@basbuddy/shared';

export type MovementStatus = 'cruising' | 'slow_traffic' | 'in_transit' | 'at_stop' | 'holding_dwell';

export interface VehicleMovementState {
  status: MovementStatus;
  label: string;
  badgeClass: string;
  pulseClass: string;
  speedKmh?: number | null;
}

export interface DwellRecord {
  stopId: string;
  firstStationaryMs: number;
  lastPollMs: number;
  consecutiveStationaryCycles: number;
}

export interface VehicleStopProgress {
  nearestStop: RouteStopItem | null;
  nextStop: RouteStopItem | null;
  stopSequence: number | null;
  stopsRemaining: number | null;
}

/**
 * Returns movement status, badge colors, and display copy based on observed dwell time and speed telemetry.
 */
export function getVehicleMovementState(
  dwellMinutes = 0,
  speedKmh?: number | null,
): VehicleMovementState {
  if (dwellMinutes >= 10) {
    const minsText = `${Math.floor(dwellMinutes)}m`;
    return {
      status: 'holding_dwell',
      label: `Holding / Dwell (~${minsText})`,
      badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
      pulseClass: 'bg-amber-400',
      speedKmh,
    };
  }

  if (dwellMinutes > 0) {
    return {
      status: 'at_stop',
      label: 'At Stop',
      badgeClass: 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
      pulseClass: 'bg-sky-400',
      speedKmh,
    };
  }

  if (speedKmh !== undefined && speedKmh !== null && !isNaN(speedKmh)) {
    const roundedSpeed = Math.round(speedKmh);
    if (speedKmh >= 35) {
      return {
        status: 'cruising',
        label: `Cruising (${roundedSpeed} km/h)`,
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
        pulseClass: 'bg-emerald-400 animate-pulse',
        speedKmh,
      };
    }

    if (speedKmh > 0 && speedKmh < 15) {
      return {
        status: 'slow_traffic',
        label: `Slow Traffic (${roundedSpeed} km/h)`,
        badgeClass: 'bg-orange-500/20 text-orange-300 border border-orange-500/40',
        pulseClass: 'bg-orange-400',
        speedKmh,
      };
    }

    if (speedKmh >= 15 && speedKmh < 35) {
      return {
        status: 'in_transit',
        label: `En Route (${roundedSpeed} km/h)`,
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
        pulseClass: 'bg-emerald-400 animate-pulse',
        speedKmh,
      };
    }

    if (speedKmh === 0) {
      return {
        status: 'at_stop',
        label: 'Stationary (0 km/h)',
        badgeClass: 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
        pulseClass: 'bg-sky-400',
        speedKmh,
      };
    }
  }

  return {
    status: 'in_transit',
    label: 'En Route',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    pulseClass: 'bg-emerald-400 animate-pulse',
    speedKmh,
  };
}

/**
 * Formats ISO timestamp to human-friendly relative time (e.g., "12s ago", "2m ago").
 */
export function formatRelativeGpsAge(timestampIso?: string | null, nowMs = Date.now()): string {
  if (!timestampIso) return 'Unknown GPS';
  const parsedMs = new Date(timestampIso).getTime();
  if (isNaN(parsedMs)) return 'Unknown GPS';

  const diffSec = Math.max(0, Math.floor((nowMs - parsedMs) / 1000));
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  return `${diffHours}h ago`;
}

/**
 * Builds a unified lookup Map of all stops across all route directions.
 */
export function buildRouteStopsLookup(
  directions: RouteDirection[] = [],
  fallbackStops: RouteStopItem[] = [],
): Map<string, RouteStopItem> {
  const lookup = new Map<string, RouteStopItem>();

  for (const dir of directions) {
    if (dir.stops) {
      for (const stop of dir.stops) {
        if (!lookup.has(stop.stopId)) {
          lookup.set(stop.stopId, stop);
        }
      }
    }
  }

  for (const stop of fallbackStops) {
    if (!lookup.has(stop.stopId)) {
      lookup.set(stop.stopId, stop);
    }
  }

  return lookup;
}

/**
 * Resolves nearest stop, next upcoming stop, and sequence progress for a vehicle.
 */
export function findVehicleStopProgress(
  vehicle: LiveVehicle,
  stopsLookup: Map<string, RouteStopItem>,
  directionStops?: RouteStopItem[],
): VehicleStopProgress {
  const nearestStop = vehicle.nearestStopId ? stopsLookup.get(vehicle.nearestStopId) ?? null : null;
  const nextStop = vehicle.nextStopId ? stopsLookup.get(vehicle.nextStopId) ?? null : null;

  if (!directionStops || directionStops.length === 0) {
    return {
      nearestStop,
      nextStop,
      stopSequence: nearestStop?.stopSequence ?? null,
      stopsRemaining: null,
    };
  }

  const nearestIndex = directionStops.findIndex((s) => s.stopId === vehicle.nearestStopId);
  const stopSequence = nearestIndex !== -1 ? directionStops[nearestIndex]!.stopSequence : nearestStop?.stopSequence ?? null;
  const stopsRemaining = nearestIndex !== -1 ? Math.max(0, directionStops.length - 1 - nearestIndex) : null;

  let resolvedNextStop = nextStop;
  if (!resolvedNextStop && nearestIndex !== -1 && nearestIndex < directionStops.length - 1) {
    resolvedNextStop = directionStops[nearestIndex + 1] ?? null;
  }

  return {
    nearestStop,
    nextStop: resolvedNextStop,
    stopSequence,
    stopsRemaining,
  };
}

/**
 * Pure state manager for client-side dwell observation:
 * - Scoped by `${routeId}:${tripId}`
 * - Prunes any entries not starting with `${routeId}:` (route switch isolation)
 * - Prunes departed trips no longer in `vehicles`
 * - Accumulates dwell minutes after debounced consecutive stationary observations at the same stop
 * - Returns a map of `tripId -> dwellMinutes`
 */
export function updateDwellTracker(
  dwellMap: Map<string, DwellRecord>,
  routeId: string,
  vehicles: LiveVehicle[],
  nowMs = Date.now(),
): Map<string, number> {
  const dwellMinutesMap = new Map<string, number>();
  const prefix = `${routeId}:`;
  const activeTripKeys = new Set<string>();

  for (const vehicle of vehicles) {
    if (!vehicle.tripId) continue;
    const key = `${prefix}${vehicle.tripId}`;
    activeTripKeys.add(key);

    const nearestStopId = vehicle.nearestStopId;
    if (!nearestStopId) {
      dwellMap.delete(key);
      dwellMinutesMap.set(vehicle.tripId, 0);
      continue;
    }

    const existing = dwellMap.get(key);

    if (existing && existing.stopId === nearestStopId) {
      const consecutiveCycles = existing.consecutiveStationaryCycles + 1;
      const totalDwellMs = nowMs - existing.firstStationaryMs;
      // Confirmed dwell duration in minutes across consecutive observations
      const confirmedDwellMinutes = Math.max(0, totalDwellMs / (60 * 1000));

      dwellMap.set(key, {
        stopId: nearestStopId,
        firstStationaryMs: existing.firstStationaryMs,
        lastPollMs: nowMs,
        consecutiveStationaryCycles: consecutiveCycles,
      });
      dwellMinutesMap.set(vehicle.tripId, confirmedDwellMinutes);
    } else {
      dwellMap.set(key, {
        stopId: nearestStopId,
        firstStationaryMs: nowMs,
        lastPollMs: nowMs,
        consecutiveStationaryCycles: 1,
      });
      dwellMinutesMap.set(vehicle.tripId, 0);
    }
  }

  // Prune any entries not belonging to current routeId or disappeared trips
  for (const key of dwellMap.keys()) {
    if (!key.startsWith(prefix) || !activeTripKeys.has(key)) {
      dwellMap.delete(key);
    }
  }

  return dwellMinutesMap;
}
