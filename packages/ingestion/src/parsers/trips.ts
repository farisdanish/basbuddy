import { parse } from 'csv-parse/sync';
import type { GtfsTrip } from '@basbuddy/shared';

export function parseTrips(csv: string): GtfsTrip[] {
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<
    string,
    string
  >[];

  return rows.map((r) => ({
    trip_id: r['trip_id'] ?? '',
    route_id: r['route_id'] ?? '',
    service_id: r['service_id'] ?? '',
    shape_id: r['shape_id'] ?? '',
    trip_headsign: r['trip_headsign'] ?? '',
    direction_id: parseInt(r['direction_id'] ?? '0', 10),
  }));
}
