import 'dotenv/config';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { fetchRealtimeFeed } from './fetch.js';
import { decodeRealtimeFeed } from './decode.js';
import { loadStaticLookup, type StaticLookup } from './staticLookup.js';
import { runPollCycle } from './cycle.js';
import { VALKEY_KEYS } from '@basbuddy/shared';

// ─── Poller Entry Point ───────────────────────────────────────────────────────
// This must remain a SINGLE INSTANCE — it is the sole caller of data.gov.my.
// The 4 req/min rate limit (§3) is shared across ALL requests; running two
// pollers would consume the entire budget just on realtime fetches.
//
// The poller loop uses drift correction: it measures actual cycle elapsed time
// and adjusts the next setTimeout accordingly, so cycles don't gradually drift
// or stack if upstream is slow.

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '30000', 10);
const GTFS_REALTIME_URL =
  process.env.GTFS_REALTIME_URL ??
  'https://api.data.gov.my/gtfs-realtime/vehicle-position/prasarana?category=rapid-bus-kl';

async function main(): Promise<void> {
  console.log('[poller] BasBuddy GTFS-RT Poller starting...');
  console.log(`[poller] Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`[poller] Feed URL: ${GTFS_REALTIME_URL}`);

  // ── Valkey (Redis-compatible) ────────────────────────────────────────────────
  const valkey = new Redis({
    host: process.env.VALKEY_HOST ?? 'localhost',
    port: parseInt(process.env.VALKEY_PORT ?? '6379', 10),
    password: process.env.VALKEY_PASSWORD || undefined,
    lazyConnect: true,
  });

  await valkey.connect();
  console.log('[poller] Connected to Valkey.');

  // ── Postgres (static data lookup) ────────────────────────────────────────────
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    database: process.env.POSTGRES_DB ?? 'basbuddy',
    user: process.env.POSTGRES_USER ?? 'basbuddy',
    password: process.env.POSTGRES_PASSWORD,
  });

  // Load trips/shapes into memory once at startup — avoids a Postgres round-trip
  // per vehicle per poll cycle. Refresh this by restarting the poller after ingest.
  console.log('[poller] Loading static lookup tables from Postgres...');
  let staticLookup: StaticLookup = await loadStaticLookup(pool);
  console.log(
    `[poller] Loaded ${staticLookup.tripCount} trips, ${staticLookup.shapeCount} shape points.`,
  );

  // ── Drift-corrected poll loop ────────────────────────────────────────────────
  let cycleNumber = 0;

  async function scheduleCycle(targetTime: number): Promise<void> {
    const delay = Math.max(0, targetTime - Date.now());
    setTimeout(async () => {
      const nextTarget = targetTime + POLL_INTERVAL_MS;
      cycleNumber++;

      try {
        await runPollCycle({
          cycleNumber,
          url: GTFS_REALTIME_URL,
          valkey,
          pool,
          staticLookup,
        });
        // Update the heartbeat key unconditionally even if cycle had partial errors
        await valkey.set(VALKEY_KEYS.pollerLastSuccess, new Date().toISOString());
      } catch (err) {
        // Log and continue — one bad cycle must never crash the loop.
        // The heartbeat key is NOT written on a total cycle failure, which is
        // the intended signal: if poller:last_success goes stale, something is wrong.
        console.error(`[poller] Cycle ${cycleNumber} failed:`, err);
      }

      // Schedule next cycle regardless of success/failure
      void scheduleCycle(nextTarget);
    }, delay);
  }

  // Kick off first cycle immediately
  void scheduleCycle(Date.now());

  // ── Graceful shutdown ────────────────────────────────────────────────────────
  process.on('SIGTERM', async () => {
    console.log('[poller] SIGTERM received, shutting down...');
    await valkey.quit();
    await pool.end();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[poller] SIGINT received, shutting down...');
    await valkey.quit();
    await pool.end();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[poller] ✗ Fatal startup error:', err);
  process.exit(1);
});
