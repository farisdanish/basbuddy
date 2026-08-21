// ─── GTFS Static Row Types ────────────────────────────────────────────────────
// Typed representations of the relevant GTFS .txt CSV rows.
// These match the Postgres schema in §7 of the plan.

// ── routes.txt ────────────────────────────────────────────────────────────────

export interface GtfsRoute {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  /** Hex color string, e.g. "FF0000". May be absent in the feed. */
  route_color: string;
}

// ── stops.txt ─────────────────────────────────────────────────────────────────

export interface GtfsStop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
}

// ── trips.txt ─────────────────────────────────────────────────────────────────

export interface GtfsTrip {
  trip_id: string;
  route_id: string;
  service_id: string;
  shape_id: string;
  trip_headsign: string;
  /** 0 = outbound, 1 = inbound (per GTFS spec). */
  direction_id: number;
}

// ── stop_times.txt ────────────────────────────────────────────────────────────

export interface GtfsStopTime {
  trip_id: string;
  stop_id: string;
  stop_sequence: number;
  /**
   * GTFS time strings can exceed 24:00:00 (e.g. "25:30:00" = 1:30am next day).
   * Stored as TEXT in Postgres. Never cast to a native TIME type.
   * Parse to seconds-since-midnight in application code only.
   */
  arrival_time: string;
  departure_time: string;
}

// ── shapes.txt ────────────────────────────────────────────────────────────────

export interface GtfsShape {
  shape_id: string;
  shape_pt_lat: number;
  shape_pt_lon: number;
  shape_pt_sequence: number;
}

// ── calendar.txt ──────────────────────────────────────────────────────────────

export interface GtfsCalendar {
  service_id: string;
  monday: 0 | 1;
  tuesday: 0 | 1;
  wednesday: 0 | 1;
  thursday: 0 | 1;
  friday: 0 | 1;
  saturday: 0 | 1;
  sunday: 0 | 1;
  /** YYYYMMDD format in the raw feed. */
  start_date: string;
  /** YYYYMMDD format in the raw feed. */
  end_date: string;
}

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Parse a GTFS time string (HH:MM:SS, may exceed 24:00:00) to seconds since
 * the service day start (midnight Asia/Kuala_Lumpur).
 *
 * Example: "25:30:00" → 91800 (25*3600 + 30*60)
 *
 * Throws if the string is malformed.
 */
export function parseGtfsTime(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  if (parts.length !== 3) {
    throw new Error(`Invalid GTFS time string: "${timeStr}"`);
  }
  const [h, m, s] = parts.map(Number);
  if ([h, m, s].some(isNaN)) {
    throw new Error(`Invalid GTFS time string (non-numeric part): "${timeStr}"`);
  }
  return h * 3600 + m * 60 + s;
}
