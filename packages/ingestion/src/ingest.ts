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
import { getFeedsToIngest, type FeedConfig } from './config.js';

// ─── Entry point for the M1/M2 Multi-Feed Ingestion Pipeline ─────────────────
// Run with:  npm run ingest                       (ingests all configured feeds)
// Or feed:   npm run ingest -- --feed=rapid-bus-kl
// Or cron:   0 4 * * * cd /path/to/basbuddy && npm run ingest >> /var/log/basbuddy-ingest.log 2>&1

async function ingestFeed(pool: Pool, feed: FeedConfig): Promise<void> {
  const startedAt = Date.now();
  console.log(`\n================================================================`);
  console.log(`[ingest] Processing feed "${feed.name}" [${feed.id}]`);
  console.log(`[ingest] Source URL: ${feed.url}`);
  console.log(`================================================================`);

  // ── 1. Download ─────────────────────────────────────────────────────────────
  console.log(`[ingest:${feed.id}] Downloading ZIP...`);
  const zipBuffer = await fetchStaticFeed(feed.url);
  console.log(`[ingest:${feed.id}] Downloaded ${(zipBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

  // ── 2. Unzip ─────────────────────────────────────────────────────────────────
  console.log(`[ingest:${feed.id}] Unzipping feed...`);
  const files = unzipFeed(zipBuffer);
  console.log(`[ingest:${feed.id}] Files in ZIP: ${Object.keys(files).join(', ')}`);

  // ── 3. Parse ─────────────────────────────────────────────────────────────────
  console.log(`[ingest:${feed.id}] Parsing CSV files...`);
  const [routes, stops, trips, stopTimes, shapes, calendar] = await Promise.all([
    parseRoutes(files['routes.txt'] ?? fail(feed.id, 'routes.txt missing from ZIP')),
    parseStops(files['stops.txt'] ?? fail(feed.id, 'stops.txt missing from ZIP')),
    parseTrips(files['trips.txt'] ?? fail(feed.id, 'trips.txt missing from ZIP')),
    parseStopTimes(files['stop_times.txt'] ?? fail(feed.id, 'stop_times.txt missing from ZIP')),
    parseShapes(files['shapes.txt'] ?? fail(feed.id, 'shapes.txt missing from ZIP')),
    parseCalendar(files['calendar.txt'] ?? fail(feed.id, 'calendar.txt missing from ZIP')),
  ]);

  logRowCounts(feed.id, { routes, stops, trips, stopTimes, shapes, calendar });

  // ── 4. Upsert ─────────────────────────────────────────────────────────────────
  console.log(`[ingest:${feed.id}] Upserting into Postgres with feed_id="${feed.id}"...`);
  await upsertAll(pool, { routes, stops, trips, stopTimes, shapes, calendar }, feed.id);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[ingest:${feed.id}] ✓ Feed "${feed.id}" completed successfully in ${elapsed}s`);
}

async function main(): Promise<void> {
  const overallStart = Date.now();
  const cliArg = process.argv.find((arg) => arg.startsWith('--feed='));
  const feeds = getFeedsToIngest(cliArg);

  console.log(`[ingest] Starting multi-feed GTFS static ingestion at ${new Date().toISOString()}`);
  console.log(`[ingest] Target feeds: ${feeds.map((f) => f.id).join(', ')}`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? 'basbuddy',
    user: process.env.POSTGRES_USER ?? 'basbuddy',
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    for (let i = 0; i < feeds.length; i++) {
      const feed = feeds[i]!;
      try {
        await ingestFeed(pool, feed);
      } catch (feedErr) {
        console.error(`[ingest] ✗ Failed processing feed "${feed.id}":`, feedErr);
        // If ingesting multiple feeds, continue to next feed unless rapid-bus-kl fails
        if (feeds.length === 1 || feed.id === 'rapid-bus-kl') {
          throw feedErr;
        }
      }

      // Sequential 5-second staggered pacing between downloads to protect data.gov.my rate limits
      if (i < feeds.length - 1) {
        console.log(`[ingest] Waiting 5s before next feed download to pace API requests...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    const totalElapsed = ((Date.now() - overallStart) / 1000).toFixed(1);
    console.log(`\n🎉 [ingest] All feeds completed in ${totalElapsed}s`);
  } finally {
    await pool.end();
  }
}

function logRowCounts(feedId: string, data: Record<string, unknown[]>): void {
  const rows = Object.entries(data)
    .map(([k, v]) => `  ${k}: ${v.length.toLocaleString()} rows`)
    .join('\n');
  console.log(`[ingest:${feedId}] Parsed row counts:\n${rows}`);

  for (const [key, arr] of Object.entries(data)) {
    if (arr.length === 0) {
      console.warn(`[ingest:${feedId}] ⚠️  WARNING: ${key} parsed 0 rows — check upstream feed.`);
    }
  }
}

function fail(feedId: string, msg: string): never {
  throw new Error(`[ingest:${feedId}] ${msg}`);
}

main().catch((err) => {
  console.error('[ingest] ✗ Fatal error:', err);
  process.exit(1);
});
