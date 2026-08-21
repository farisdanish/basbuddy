import 'dotenv/config';
import { Pool } from 'pg';
import { fetchStaticFeed } from './fetch.js';
import { unzipFeed } from './unzip.js';
import { parseRoutes } from './parsers/routes.js';
import { parseStops } from './parsers/stops.js';
import { parseTrips } from './parsers/trips.js';
import { parseStopTimes } from './parsers/stopTimes.js';
import { parseShapes } from './parsers/shapes.js';
import { parseCalendar } from './parsers/calendar.js';
import { upsertAll } from './upsert.js';

// ─── Entry point for the M1 ingestion script ─────────────────────────────────
// Run with:  npm run ingest   (tsx src/ingest.ts)
// Or cron:   0 4 * * * cd /path/to/basbuddy && npm run ingest >> /var/log/basbuddy-ingest.log 2>&1

const GTFS_STATIC_URL =
  process.env.GTFS_STATIC_URL ??
  'https://api.data.gov.my/gtfs-static/prasarana?category=rapid-bus-kl';

async function main(): Promise<void> {
  const startedAt = Date.now();
  console.log(`[ingest] Starting GTFS static ingestion at ${new Date().toISOString()}`);
  console.log(`[ingest] Source: ${GTFS_STATIC_URL}`);

  // ── 1. Download ─────────────────────────────────────────────────────────────
  console.log('[ingest] Downloading ZIP...');
  const zipBuffer = await fetchStaticFeed(GTFS_STATIC_URL);
  console.log(`[ingest] Downloaded ${(zipBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

  // ── 2. Unzip ─────────────────────────────────────────────────────────────────
  console.log('[ingest] Unzipping feed...');
  const files = unzipFeed(zipBuffer);
  console.log(`[ingest] Files in ZIP: ${Object.keys(files).join(', ')}`);

  // ── 3. Parse ─────────────────────────────────────────────────────────────────
  console.log('[ingest] Parsing CSV files...');
  const [routes, stops, trips, stopTimes, shapes, calendar] = await Promise.all([
    parseRoutes(files['routes.txt'] ?? fail('routes.txt missing from ZIP')),
    parseStops(files['stops.txt'] ?? fail('stops.txt missing from ZIP')),
    parseTrips(files['trips.txt'] ?? fail('trips.txt missing from ZIP')),
    parseStopTimes(files['stop_times.txt'] ?? fail('stop_times.txt missing from ZIP')),
    parseShapes(files['shapes.txt'] ?? fail('shapes.txt missing from ZIP')),
    parseCalendar(files['calendar.txt'] ?? fail('calendar.txt missing from ZIP')),
  ]);

  logRowCounts({ routes, stops, trips, stopTimes, shapes, calendar });

  // ── 4. Upsert ─────────────────────────────────────────────────────────────────
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? 'basbuddy',
    user: process.env.POSTGRES_USER ?? 'basbuddy',
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    console.log('[ingest] Upserting into Postgres...');
    await upsertAll(pool, { routes, stops, trips, stopTimes, shapes, calendar });
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[ingest] ✓ Done in ${elapsed}s`);
  } finally {
    await pool.end();
  }
}

function logRowCounts(data: Record<string, unknown[]>): void {
  const rows = Object.entries(data)
    .map(([k, v]) => `  ${k}: ${v.length.toLocaleString()} rows`)
    .join('\n');
  console.log(`[ingest] Parsed row counts:\n${rows}`);

  // Sanity check — any empty table is suspicious
  for (const [key, arr] of Object.entries(data)) {
    if (arr.length === 0) {
      console.warn(`[ingest] ⚠️  WARNING: ${key} parsed 0 rows — check the upstream feed.`);
    }
  }
}

function fail(msg: string): never {
  throw new Error(`[ingest] ${msg}`);
}

main().catch((err) => {
  console.error('[ingest] ✗ Fatal error:', err);
  process.exit(1);
});
