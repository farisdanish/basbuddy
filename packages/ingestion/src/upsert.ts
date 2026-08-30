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
// ON CONFLICT (feed_id, ...) DO UPDATE scopes all upserts to the specific feed
// to prevent cross-feed ID collisions or data corruption.
// The transaction is all-or-nothing: a failure in any table rolls back everything,
// so the DB is never left in a half-updated state.

const BATCH_SIZE = 1000;

interface IngestData {
  routes: GtfsRoute[];
  stops: GtfsStop[];
  trips: GtfsTrip[];
  stopTimes: GtfsStopTime[];
  shapes: GtfsShape[];
  calendar: GtfsCalendar[];
}

export async function upsertAll(
  pool: Pool,
  data: IngestData,
  feedId: string = 'rapid-bus-kl',
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await upsertRoutes(client, data.routes, feedId);
    await upsertCalendar(client, data.calendar, feedId);
    await upsertStops(client, data.stops, feedId);
    await upsertTrips(client, data.trips, feedId);
    await upsertShapes(client, data.shapes, feedId);
    await upsertStopTimes(client, data.stopTimes, feedId);

    await client.query('COMMIT');
    console.log(`[upsert] Transaction committed for feed "${feedId}".`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[upsert] Transaction rolled back for feed "${feedId}" due to error:`, err);
    throw err;
  } finally {
    client.release();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── Table upserts ─────────────────────────────────────────────────────────────

async function upsertRoutes(
  client: PoolClient,
  rows: GtfsRoute[],
  feedId: string,
): Promise<void> {
  let count = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const values = batch.flatMap((r) => [
      feedId,
      r.route_id,
      r.route_short_name,
      r.route_long_name,
      r.route_color,
    ]);
    const placeholders = batch
      .map(
        (_, i) =>
          `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`,
      )
      .join(', ');

    await client.query(
      `INSERT INTO routes (feed_id, route_id, route_short_name, route_long_name, route_color)
       VALUES ${placeholders}
       ON CONFLICT (feed_id, route_id) DO UPDATE SET
         route_short_name = EXCLUDED.route_short_name,
         route_long_name  = EXCLUDED.route_long_name,
         route_color      = EXCLUDED.route_color`,
      values,
    );
    count += batch.length;
  }
  console.log(`[upsert] routes (${feedId}): ${count} rows`);
}

async function upsertCalendar(
  client: PoolClient,
  rows: GtfsCalendar[],
  feedId: string,
): Promise<void> {
  let count = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const values = batch.flatMap((r) => [
      feedId,
      r.service_id,
      r.monday,
      r.tuesday,
      r.wednesday,
      r.thursday,
      r.friday,
      r.saturday,
      r.sunday,
      `${r.start_date.slice(0, 4)}-${r.start_date.slice(4, 6)}-${r.start_date.slice(6, 8)}`,
      `${r.end_date.slice(0, 4)}-${r.end_date.slice(4, 6)}-${r.end_date.slice(6, 8)}`,
    ]);
    const placeholders = batch
      .map(
        (_, i) =>
          `($${i * 11 + 1}, $${i * 11 + 2}, $${i * 11 + 3}, $${i * 11 + 4}, $${i * 11 + 5}, ` +
          `$${i * 11 + 6}, $${i * 11 + 7}, $${i * 11 + 8}, $${i * 11 + 9}, $${i * 11 + 10}, $${i * 11 + 11})`,
      )
      .join(', ');

    await client.query(
      `INSERT INTO calendar (feed_id, service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date)
       VALUES ${placeholders}
       ON CONFLICT (feed_id, service_id) DO UPDATE SET
         monday=EXCLUDED.monday, tuesday=EXCLUDED.tuesday, wednesday=EXCLUDED.wednesday,
         thursday=EXCLUDED.thursday, friday=EXCLUDED.friday, saturday=EXCLUDED.saturday,
         sunday=EXCLUDED.sunday, start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date`,
      values,
    );
    count += batch.length;
  }
  console.log(`[upsert] calendar (${feedId}): ${count} rows`);
}

async function upsertStops(
  client: PoolClient,
  rows: GtfsStop[],
  feedId: string,
): Promise<void> {
  let count = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const values = batch.flatMap((r) => [feedId, r.stop_id, r.stop_name, r.stop_lat, r.stop_lon]);
    const placeholders = batch
      .map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`)
      .join(', ');

    await client.query(
      `INSERT INTO stops (feed_id, stop_id, stop_name, stop_lat, stop_lon)
       VALUES ${placeholders}
       ON CONFLICT (feed_id, stop_id) DO UPDATE SET
         stop_name = EXCLUDED.stop_name,
         stop_lat  = EXCLUDED.stop_lat,
         stop_lon  = EXCLUDED.stop_lon`,
      values,
    );
    count += batch.length;
  }
  console.log(`[upsert] stops (${feedId}): ${count} rows`);
}

async function upsertTrips(
  client: PoolClient,
  rows: GtfsTrip[],
  feedId: string,
): Promise<void> {
  let count = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const values = batch.flatMap((r) => [
      feedId,
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
          `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`,
      )
      .join(', ');

    await client.query(
      `INSERT INTO trips (feed_id, trip_id, route_id, service_id, shape_id, trip_headsign, direction_id)
       VALUES ${placeholders}
       ON CONFLICT (feed_id, trip_id) DO UPDATE SET
         route_id      = EXCLUDED.route_id,
         service_id    = EXCLUDED.service_id,
         shape_id      = EXCLUDED.shape_id,
         trip_headsign = EXCLUDED.trip_headsign,
         direction_id  = EXCLUDED.direction_id`,
      values,
    );
    count += batch.length;
  }
  console.log(`[upsert] trips (${feedId}): ${count} rows`);
}

async function upsertShapes(
  client: PoolClient,
  rows: GtfsShape[],
  feedId: string,
): Promise<void> {
  let count = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const values = batch.flatMap((r) => [
      feedId,
      r.shape_id,
      r.shape_pt_lat,
      r.shape_pt_lon,
      r.shape_pt_sequence,
    ]);
    const placeholders = batch
      .map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`)
      .join(', ');

    await client.query(
      `INSERT INTO shapes (feed_id, shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence)
       VALUES ${placeholders}
       ON CONFLICT (feed_id, shape_id, shape_pt_sequence) DO UPDATE SET
         shape_pt_lat = EXCLUDED.shape_pt_lat,
         shape_pt_lon = EXCLUDED.shape_pt_lon`,
      values,
    );
    count += batch.length;
  }
  console.log(`[upsert] shapes (${feedId}): ${count} rows`);
}

async function upsertStopTimes(
  client: PoolClient,
  rows: GtfsStopTime[],
  feedId: string,
): Promise<void> {
  const STOP_TIMES_BATCH = 500;
  let count = 0;
  for (const batch of chunk(rows, STOP_TIMES_BATCH)) {
    const values = batch.flatMap((r) => [
      feedId,
      r.trip_id,
      r.stop_id,
      r.stop_sequence,
      r.arrival_time,
      r.departure_time,
    ]);
    const placeholders = batch
      .map(
        (_, i) =>
          `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`,
      )
      .join(', ');

    await client.query(
      `INSERT INTO stop_times (feed_id, trip_id, stop_id, stop_sequence, arrival_time, departure_time)
       VALUES ${placeholders}
       ON CONFLICT (feed_id, trip_id, stop_sequence) DO UPDATE SET
         stop_id        = EXCLUDED.stop_id,
         arrival_time   = EXCLUDED.arrival_time,
         departure_time = EXCLUDED.departure_time`,
      values,
    );
    count += batch.length;
  }
  console.log(`[upsert] stop_times (${feedId}): ${count} rows`);
}
