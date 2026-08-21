import { parse } from 'csv-parse/sync';
import type { GtfsShape } from '@basbuddy/shared';

export function parseShapes(csv: string): GtfsShape[] {
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<
    string,
    string
  >[];

  return rows.map((r) => ({
    shape_id: r['shape_id'] ?? '',
    shape_pt_lat: parseFloat(r['shape_pt_lat'] ?? '0'),
    shape_pt_lon: parseFloat(r['shape_pt_lon'] ?? '0'),
    shape_pt_sequence: parseInt(r['shape_pt_sequence'] ?? '0', 10),
  }));
}
