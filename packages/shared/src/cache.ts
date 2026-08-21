// ─── Valkey Cache Shapes ──────────────────────────────────────────────────────
// Defines the JSON structures stored in Valkey by the poller (§2 of the Execution Spec).
// The API layer reads these directly without recomputation.

// ── Key patterns ──────────────────────────────────────────────────────────────
// vehicle:{tripId}            → STRING → VehiclePositionCache   TTL: 240s
// stop_etas:{stopId}          → STRING → StopEtasResponse       TTL: 240s
// route:{routeId}:vehicles    → SET    → Set<tripId>            TTL: 240s
// poller:last_success         → STRING → ISO 8601 timestamp     no TTL

export const VALKEY_KEYS = {
  vehicle: (tripId: string) => `vehicle:${tripId}`,
  stopEtas: (stopId: string) => `stop_etas:${stopId}`,
  routeVehicles: (routeId: string) => `route:${routeId}:vehicles`,
  pollerLastSuccess: 'poller:last_success',
} as const;

/** Default TTL in seconds for vehicle and stop_etas keys. */
export const VEHICLE_TTL_SECONDS = 240;

/**
 * Threshold (seconds) beyond which poller:last_success is considered stale.
 * 3 missed 30s cycles = 90s. If exceeded, treat the whole feed as suspect.
 */
export const POLLER_STALENESS_THRESHOLD_SECONDS = 90;

// ── VehiclePositionCache ──────────────────────────────────────────────────────

/**
 * Stored under `vehicle:{tripId}` by the poller.
 * One entry per active trip in the current GTFS-RT snapshot.
 */
export interface VehiclePositionCache {
  tripId: string;
  routeId: string;
  directionId: number;
  lat: number;
  lon: number;
  /** Degrees 0–359, or null if absent from the GTFS-RT entity. */
  bearing: number | null;
  /**
   * ISO 8601 timestamp from the GTFS-RT entity itself (vehicle.timestamp),
   * NOT the poller's wall clock. Used for freshness checks.
   */
  timestamp: string;
}

// ── Re-export StopEtasResponse for the poller ─────────────────────────────────
// The poller writes a StopEtasResponse directly into stop_etas:{stopId}.
// Re-exported here so the poller only needs to import from @basbuddy/shared.
export type { StopEtasResponse, StopArrival } from './api.js';
