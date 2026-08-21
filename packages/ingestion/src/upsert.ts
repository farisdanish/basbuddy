import type { Pool, PoolClient } from 'pg';
import type {
  GtfsRoute,
  GtfsStop,
  GtfsTrip,
  GtfsStopTime,
  GtfsShape,
  GtfsCalendar,
} from '@basbuddy/shared';

// ─── upsertAll ────────────────────────────────────────────────────────────────
// Upserts all parsed GTFS tables inside a single Postgres transaction.
// ON CONFLICT ... DO UPDATE means running ingest twice produces identical results.
// The transaction is all-or-nothing: a failure in any table rolls back everything,
// so the DB is never left in a half-updated state.

// Batch size for INSERT statements — large tables (stop_times, shapes) can have
// millions of rows; batching avoids "too many parameters" errors and memory spikes.
const BATCH_SIZE = 1000;

interface IngestData {
  routes: GtfsRoute[];
  stops: GtfsStop[];
  trips: GtfsTrip[];
  stopTimes: GtfsStopTime[];
  shapes: GtfsShape[];
  calendar: GtfsCalendar[];
}

export async function upsertAll(pool: Pool, data: IngestData): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await upsertRoutes(client, data.routes);
    await upsertCalendar(client, data.calendar);
    await upsertStops(client, data.stops);
    await upsertTrips(client, data.trips);
    await upsertShapes(client, data.shapes);
    await upsertStopTimes(client, data.stopTimes);

    await client.query('COMMIT');
    console.log('[upsert] Transaction committed.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[upsert] Transaction rolled back due to error:', err);
    throw err;
  } finally {
    client.release();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Splits an array into chunks of `size`.
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── Table upserts ─────────────────────────────────────────────────────────────

async function upsertRoutes(client: PoolClient, rows: GtfsRoute[]): Promise<void> {
  let count = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const values = batch.flatMap((r) => [
      r.route_id,
      r.route_short_name,
      r.route_long_name,
      r.route_color,
    ]);
    const placeholders = batch
      .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
      .join(', ');

    await client.query(
      `INSERT INTO routes (route_id, route_short_name, route_long_name, route_color)
       VALUES ${placeholders}
       ON CONFLICT (route_id) DO UPDATE SET
         route_short_name = EXCLUDED.route_short_name,
         route_long_name  = EXCLUDED.route_long_name,
         route_color      = EXCLUDED.route_color`,
      values,
    );
    count += batch.length;
  }
  console.log(`[upsert] routes: ${count} rows`);
}

async function upsertCalendar(client: PoolClient, rows: GtfsCalendar[]): Promise<void> {
  let count = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const values = batch.flatMap((r) => [
      r.service_id,
      r.monday,
      r.tuesday,
      r.wednesday,
      r.thursday,
      r.friday,
      r.saturday,
      r.sunday,
      // Convert YYYYMMDD string to a Postgres DATE-compatible string YYYY-MM-DD
      `${r.start_date.slice(0, 4)}-${r.start_date.slice(4, 6)}-${r.start_date.slice(6, 8)}`,
      `${r.end_date.slice(0, 4)}-${r.end_date.slice(4, 6)}-${r.end_date.slice(6, 8)}`,
    ]);
    const placeholders = batch
      .map(
        (_, i) =>
          `($${i * 10 + 1}, $${i * 10 + 2}, $${i * 10 + 3}, $${i * 10 + 4}, $${i * 10 + 5}, ` +
          `$${i * 10 + 6}, $${i * 10 + 7}, $${i * 10 + 8}, $${i * 10 + 9}, $${i * 10 + 10})`,
      )
      .join(', ');

    await client.query(
      `INSERT INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date)
       VALUES ${placeholders}
       ON CONFLICT (service_id) DO UPDATE SET
         monday=EXCLUDED.monday, tuesday=EXCLUDED.tuesday, wednesday=EXCLUDED.wednesday,
         thursday=EXCLUDED.thursday, friday=EXCLUDED.friday, saturday=EXCLUDED.saturday,
         sunday=EXCLUDED.sunday, start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date`,
      values,
    );
    count += batch.length;
  }
  console.log(`[upsert] calendar: ${count} rows`);
}

async function upsertStops(client: PoolClient, rows: GtfsStop[]): Promise<void> {
  let count = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const values = batch.flatMap((r) => [r.stop_id, r.stop_name, r.stop_lat, r.stop_lon]);
    const placeholders = batch
      .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
      .join(', ');

    await client.query(
      `INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon)
       VALUES ${placeholders}
       ON CONFLICT (stop_id) DO UPDATE SET
         stop_name = EXCLUDED.stop_name,
         stop_lat  = EXCLUDED.stop_lat,
         stop_lon  = EXCLUDED.stop_lon`,
      values,
    );
    count += batch.length;
  }
  console.log(`[upsert] stops: ${count} rows`);
}

async function upsertTrips(client: PoolClient, rows: GtfsTrip[]): Promise<void> {
  let count = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const values = batch.flatMap((r) => [
      r.trip_id,
      r.route_id,
      r.service_id,
      r.shape_id,
      r.trip_headsign,
      r.direction_id,
    ]);
    const placeholders = batch
      .map(
        (_, i) =>
          `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`,
      )
      .join(', ');

    await client.query(
      `INSERT INTO trips (trip_id, route_id, service_id, shape_id, trip_headsign, direction_id)
       VALUES ${placeholders}
       ON CONFLICT (trip_id) DO UPDATE SET
         route_id      = EXCLUDED.route_id,
         service_id    = EXCLUDED.service_id,
         shape_id      = EXCLUDED.shape_id,
         trip_headsign = EXCLUDED.trip_headsign,
         direction_id  = EXCLUDED.direction_id`,
      values,
    );
    count += batch.length;
  }
  console.log(`[upsert] trips: ${count} rows`);
}

async function upsertShapes(client: PoolClient, rows: GtfsShape[]): Promise<void> {
  let count = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const values = batch.flatMap((r) => [
      r.shape_id,
      r.shape_pt_lat,
      r.shape_pt_lon,
      r.shape_pt_sequence,
    ]);
    const placeholders = batch
      .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
      .join(', ');

    await client.query(
      `INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence)
       VALUES ${placeholders}
       ON CONFLICT (shape_id, shape_pt_sequence) DO UPDATE SET
         shape_pt_lat = EXCLUDED.shape_pt_lat,
         shape_pt_lon = EXCLUDED.shape_pt_lon`,
      values,
    );
    count += batch.length;
  }
  console.log(`[upsert] shapes: ${count} rows`);
}

async function upsertStopTimes(client: PoolClient, rows: GtfsStopTime[]): Promise<void> {
  // stop_times is the largest table — can be millions of rows.
  // We reduce BATCH_SIZE here to keep per-query parameter counts manageable.
  const STOP_TIMES_BATCH = 500;
  let count = 0;
  for (const batch of chunk(rows, STOP_TIMES_BATCH)) {
    const values = batch.flatMap((r) => [
      r.trip_id,
      r.stop_id,
      r.stop_sequence,
      r.arrival_time,   // stored as TEXT (GTFS time, may exceed 24:00:00)
      r.departure_time, // stored as TEXT
    ]);
    const placeholders = batch
      .map(
        (_, i) =>
          `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`,
      )
      .join(', ');

    await client.query(
      `INSERT INTO stop_times (trip_id, stop_id, stop_sequence, arrival_time, departure_time)
       VALUES ${placeholders}
       ON CONFLICT (trip_id, stop_sequence) DO UPDATE SET
         stop_id        = EXCLUDED.stop_id,
         arrival_time   = EXCLUDED.arrival_time,
         departure_time = EXCLUDED.departure_time`,
      values,
    );
    count += batch.length;
  }
  console.log(`[upsert] stop_times: ${count} rows`);
}
