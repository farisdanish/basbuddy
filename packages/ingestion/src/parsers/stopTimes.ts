import { parse } from 'csv-parse/sync';
import type { GtfsStopTime } from '@basbuddy/shared';

// ─── parseStopTimes ───────────────────────────────────────────────────────────
// IMPORTANT: arrival_time and departure_time are stored as-is (TEXT).
// GTFS allows values > 24:00:00 (e.g. "25:30:00" = 1:30am next service day).
// Do NOT parse these to Date or native TIME — they must stay as strings.
// Use parseGtfsTime() from @basbuddy/shared only when you need seconds-since-midnight.

export function parseStopTimes(csv: string): GtfsStopTime[] {
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<
    string,
    string
  >[];

  return rows.map((r) => ({
    trip_id: r['trip_id'] ?? '',
    stop_id: r['stop_id'] ?? '',
    stop_sequence: parseInt(r['stop_sequence'] ?? '0', 10),
    arrival_time: r['arrival_time'] ?? '',   // keep raw TEXT
    departure_time: r['departure_time'] ?? '', // keep raw TEXT
  }));
}
