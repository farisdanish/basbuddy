-- Migration 005: Feed Sync Metadata Tracking
-- Tracks daily and ad-hoc static GTFS feed ingestion history and statistics
-- for UI transparency, data freshness audits, and health diagnostics.

CREATE TABLE IF NOT EXISTS feed_sync_logs (
  id               SERIAL PRIMARY KEY,
  feed_id          TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'success',  -- 'success' | 'failed'
  routes_count     INTEGER NOT NULL DEFAULT 0,
  stops_count      INTEGER NOT NULL DEFAULT 0,
  trips_count      INTEGER NOT NULL DEFAULT 0,
  duration_seconds NUMERIC(6, 2) NOT NULL DEFAULT 0,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  error_message    TEXT
);

CREATE INDEX IF NOT EXISTS idx_feed_sync_logs_feed ON feed_sync_logs (feed_id, synced_at DESC);
