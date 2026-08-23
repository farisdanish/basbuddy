// ─── API Contract Types ───────────────────────────────────────────────────────
// Canonical shapes for BasBuddy REST API responses (§1 of the Execution Spec).
// The API server must produce these shapes; the frontend must consume them.

// ── Enums / Unions ────────────────────────────────────────────────────────────

/**
 * Whether the ETA came from a live vehicle position or the static schedule fallback.
 * 'live'     — derived from a vehicle position in Valkey (GTFS-RT matched)
 * 'schedule' — derived from stop_times in Postgres (no live position found)
 */
export type ArrivalSource = 'live' | 'schedule';

/**
 * Freshness of a specific ETA / vehicle marker.
 * 'live'        — vehicle:* Valkey key is present and within TTL
 * 'stale'       — key is approaching TTL (optional mid-state for UI degradation)
 * 'signal_lost' — key has expired, or no live position found; schedule fallback in use
 */
export type FreshnessStatus = 'live' | 'stale' | 'signal_lost';

// ── Shared sub-shapes ─────────────────────────────────────────────────────────

/**
 * Embedded vehicle position snapshot inside an ETA.
 * Null when source === 'schedule' (no live vehicle matched this trip).
 */
export interface VehicleSnapshot {
  lat: number;
  lon: number;
  /** Degrees 0–359, or null if the GTFS-RT feed didn't include it. */
  bearing: number | null;
}

// ── GET /api/stops/:stopId/etas ───────────────────────────────────────────────

export interface StopArrival {
  tripId: string;
  routeId: string;
  routeShortName: string;
  tripHeadsign: string;
  /** Seconds until this vehicle (or scheduled departure) reaches the stop. */
  etaSeconds: number;
  source: ArrivalSource;
  freshness: FreshnessStatus;
  /** null when source === 'schedule' */
  vehicle: VehicleSnapshot | null;
}

export interface StopEtasResponse {
  stopId: string;
  stopName: string;
  /**
   * ISO 8601 timestamp — when the poller computed this snapshot, NOT the
   * HTTP request time. Used by the frontend to detect a stale cache.
   */
  generatedAt: string;
  /** Sorted ascending by etaSeconds. */
  arrivals: StopArrival[];
}

// ── GET /api/stops (All / Unscoped) ───────────────────────────────────────────

export interface StopListItem {
  stopId: string;
  stopName: string;
  lat: number;
  lon: number;
}

export interface AllStopsResponse {
  stops: StopListItem[];
}

// ── GET /api/stops?near=lat,lon ───────────────────────────────────────────────

export interface NearbyStop {
  stopId: string;
  stopName: string;
  lat: number;
  lon: number;
  distanceMeters: number;
}

export interface NearbyStopsResponse {
  origin: { lat: number; lon: number };
  /** Sorted ascending by distanceMeters. */
  stops: NearbyStop[];
}

// ── GET /api/routes ───────────────────────────────────────────────────────────

export interface RouteListItem {
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  /** Hex color string from routes.txt, e.g. "FF0000". May be empty string. */
  routeColor: string;
  /** Number of active live GPS vehicles tracking on this route */
  liveBusCount?: number;
  /** Distance in meters from the requested near coordinates to the closest stop on this route */
  distanceMeters?: number;
}

export interface RoutesResponse {
  routes: RouteListItem[];
}

export interface RouteStopItem {
  stopId: string;
  stopName: string;
  lat: number;
  lon: number;
  stopSequence: number;
  /** Scheduled arrival/departure time e.g. "08:15:00" for next/active trip */
  scheduledTime?: string | null;
  /** Live ETA in seconds from nearest active bus if available */
  etaSeconds?: number | null;
  freshness?: FreshnessStatus;
}

export interface RouteDirection {
  directionId: number;
  tripHeadsign: string;
  /** Stops sequence for this direction */
  stops?: RouteStopItem[];
  /** Shape polyline coordinates for this direction */
  shapes?: Array<[lat: number, lon: number]>;
}

export interface RouteScheduledDeparture {
  tripId: string;
  departureTime: string; // e.g. "07:10:00"
  tripHeadsign: string;
  directionId: number;
}

export interface RouteTimetable {
  firstBusTime: string | null;
  lastBusTime: string | null;
  totalTripsToday: number;
  nextDepartures: RouteScheduledDeparture[];
  allDepartures: RouteScheduledDeparture[];
}

export interface RouteDetailsResponse {
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string;
  directions: RouteDirection[];
  shapes: Array<[lat: number, lon: number]>;
  stops: RouteStopItem[];
  vehicles: LiveVehicle[];
  timetable?: RouteTimetable | null;
}

// ── Origin-to-Destination Trip Calculation ───────────────────────────────────

export interface TripPlanEstimate {
  originStop: RouteStopItem;
  destinationStop: RouteStopItem;
  stopsCount: number;
  estimatedDurationMinutes: number;
  distanceMeters: number;
  liveBusEtaMinutes: number | null;
  nextScheduledDeparture: string | null;
  nextScheduledArrival: string | null;
  activeBusCount: number;
}

// ── GET /api/stops/:stopId/timetable ──────────────────────────────────────────

export interface StopTimetableDeparture {
  tripId: string;
  routeId: string;
  routeShortName: string;
  tripHeadsign: string;
  departureTime: string;
  directionId: number;
}

export interface StopTimetableResponse {
  stopId: string;
  stopName: string;
  departures: StopTimetableDeparture[];
}

// ── GET /api/routes/:routeId/vehicles ─────────────────────────────────────────

export interface LiveVehicle {
  tripId: string;
  routeId: string;
  lat: number;
  lon: number;
  bearing: number | null;
  /** ISO 8601 timestamp from the GTFS-RT entity itself (not poller wall-clock). */
  timestamp: string;
  freshness: FreshnessStatus;
  speedKmh?: number | null;
  nearestStopId?: string | null;
  nextStopId?: string | null;
  directionId?: number | null;
}

export interface RouteVehiclesResponse {
  routeId: string;
  vehicles: LiveVehicle[];
}

// ── GET/POST/DELETE /api/favorites ────────────────────────────────────────────

export interface Favorite {
  id: number;
  stopId: string | null;
  routeId: string | null;
  /** User-defined label, e.g. "Home stop" or "Route T728" */
  label: string | null;
  createdAt: string; // ISO 8601
}

export interface FavoritesResponse {
  favorites: Favorite[];
}

export interface CreateFavoriteBody {
  stopId?: string;
  routeId?: string;
  label?: string;
}

// ── GET /health ───────────────────────────────────────────────────────────────

export type HealthStatus = 'ok' | 'degraded';

export interface HealthResponse {
  status: HealthStatus;
  pollerHealthy: boolean;
  /** Age of last successful poll cycle in seconds. -1 if no heartbeat recorded. */
  pollerAgeSeconds: number;
  pollerLastSuccess: string | null;
  timestamp: string;
}

// ── Error shape ───────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message?: string;
}

