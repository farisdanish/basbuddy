import { parse } from 'csv-parse/sync';
import type { GtfsStop } from '@basbuddy/shared';

export function parseStops(csv: string): GtfsStop[] {
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<
    string,
    string
  >[];

  return rows.map((r) => ({
    stop_id: r['stop_id'] ?? '',
    stop_name: r['stop_name'] ?? '',
    stop_lat: parseFloat(r['stop_lat'] ?? '0'),
    stop_lon: parseFloat(r['stop_lon'] ?? '0'),
  }));
}
