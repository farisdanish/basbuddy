import { parse } from 'csv-parse/sync';
import type { GtfsRoute } from '@basbuddy/shared';

export function parseRoutes(csv: string): GtfsRoute[] {
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<
    string,
    string
  >[];

  return rows.map((r) => ({
    route_id: r['route_id'] ?? '',
    route_short_name: r['route_short_name'] ?? '',
    route_long_name: r['route_long_name'] ?? '',
    route_color: r['route_color'] ?? '',
  }));
}
