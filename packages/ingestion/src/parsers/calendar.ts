import { parse } from 'csv-parse/sync';
import type { GtfsCalendar } from '@basbuddy/shared';

// ─── parseCalendar ────────────────────────────────────────────────────────────
// calendar.txt encodes which days of the week a service_id is active.
// RapidKL runs different weekday/weekend schedules, so this table is essential
// for any query reading from stop_times (schedule fallback ETAs, upcoming departures).
// Without it, every trip would appear active every day — silently wrong on weekends.

export function parseCalendar(csv: string): GtfsCalendar[] {
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<
    string,
    string
  >[];

  return rows.map((r) => ({
    service_id: r['service_id'] ?? '',
    monday: (parseInt(r['monday'] ?? '0', 10) as 0 | 1),
    tuesday: (parseInt(r['tuesday'] ?? '0', 10) as 0 | 1),
    wednesday: (parseInt(r['wednesday'] ?? '0', 10) as 0 | 1),
    thursday: (parseInt(r['thursday'] ?? '0', 10) as 0 | 1),
    friday: (parseInt(r['friday'] ?? '0', 10) as 0 | 1),
    saturday: (parseInt(r['saturday'] ?? '0', 10) as 0 | 1),
    sunday: (parseInt(r['sunday'] ?? '0', 10) as 0 | 1),
    start_date: r['start_date'] ?? '', // YYYYMMDD
    end_date: r['end_date'] ?? '',     // YYYYMMDD
  }));
}
