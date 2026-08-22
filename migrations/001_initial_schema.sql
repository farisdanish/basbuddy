-- BasBuddy — Initial Schema Migration
-- Run via node-pg-migrate (or psql directly):
--   node-pg-migrate -d "$DATABASE_URL" -m ./migrations up
--
-- All timestamps in application code MUST use Asia/Kuala_Lumpur (UTC+8).
-- Set the session timezone explicitly in application code rather than relying
-- on server default — the production host may not have TZ=Asia/Kuala_Lumpur set.

-- ── routes ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS routes (
  route_id         TEXT PRIMARY KEY,
  route_short_name TEXT NOT NULL DEFAULT '',
  route_long_name  TEXT NOT NULL DEFAULT '',
  route_color      TEXT NOT NULL DEFAULT ''  -- hex string e.g. "FF0000", may be empty
);

-- ── stops ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stops (
  stop_id  TEXT PRIMARY KEY,
  stop_name TEXT NOT NULL DEFAULT '',
  stop_lat  DOUBLE PRECISION NOT NULL,
  stop_lon  DOUBLE PRECISION NOT NULL
);

-- ── calendar ──────────────────────────────────────────────────────────────────
-- Must be created before trips (trips.service_id references calendar).
-- RapidKL runs different weekday/weekend schedules; without this table,
-- every trip would read as active every day — silently wrong on weekends (§7, §8).

CREATE TABLE IF NOT EXISTS calendar (
  service_id TEXT PRIMARY KEY,
  monday     INTEGER NOT NULL CHECK (monday IN (0, 1)),
  tuesday    INTEGER NOT NULL CHECK (tuesday IN (0, 1)),
  wednesday  INTEGER NOT NULL CHECK (wednesday IN (0, 1)),
  thursday   INTEGER NOT NULL CHECK (thursday IN (0, 1)),
  friday     INTEGER NOT NULL CHECK (friday IN (0, 1)),
  saturday   INTEGER NOT NULL CHECK (saturday IN (0, 1)),
  sunday     INTEGER NOT NULL CHECK (sunday IN (0, 1)),
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL
);

-- ── trips ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trips (
  trip_id       TEXT PRIMARY KEY,
  route_id      TEXT NOT NULL REFERENCES routes (route_id) ON DELETE CASCADE,
  service_id    TEXT NOT NULL REFERENCES calendar (service_id) ON DELETE CASCADE,
  shape_id      TEXT NOT NULL DEFAULT '',
  trip_headsign TEXT NOT NULL DEFAULT '',
  direction_id  INTEGER NOT NULL DEFAULT 0  -- 0 = outbound, 1 = inbound
);

-- ── shapes ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shapes (
  shape_id          TEXT NOT NULL,
  shape_pt_lat      DOUBLE PRECISION NOT NULL,
  shape_pt_lon      DOUBLE PRECISION NOT NULL,
  shape_pt_sequence INTEGER NOT NULL,
  PRIMARY KEY (shape_id, shape_pt_sequence)
);

-- ── stop_times ────────────────────────────────────────────────────────────────
-- The largest table — potentially millions of rows.
-- arrival_time and departure_time are TEXT, not TIME.
-- GTFS allows values > 24:00:00 (e.g. "25:30:00" = 1:30am next service day).
-- Storing as TIME would silently corrupt those values.

CREATE TABLE IF NOT EXISTS stop_times (
  trip_id        TEXT NOT NULL REFERENCES trips (trip_id) ON DELETE CASCADE,
  stop_id        TEXT NOT NULL REFERENCES stops (stop_id) ON DELETE CASCADE,
  stop_sequence  INTEGER NOT NULL,
  arrival_time   TEXT NOT NULL,   -- raw GTFS time string, e.g. "08:15:00" or "25:30:00"
  departure_time TEXT NOT NULL,   -- raw GTFS time string
  PRIMARY KEY (trip_id, stop_sequence)
);

-- ── favorites ─────────────────────────────────────────────────────────────────
-- Not a GTFS import — BasBuddy's own table.
-- v1: no user_id (single user, no auth). Add user_id if/when going public.

CREATE TABLE IF NOT EXISTS favorites (
  id         SERIAL PRIMARY KEY,
  stop_id    TEXT NOT NULL REFERENCES stops (stop_id) ON DELETE CASCADE,
  route_id   TEXT REFERENCES routes (route_id) ON DELETE SET NULL,
  label      TEXT,                                        -- e.g. "Home", "Work"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- stop_times is large — without these, ETA and schedule queries do full table scans.

CREATE INDEX IF NOT EXISTS idx_stop_times_stop_id  ON stop_times (stop_id);
CREATE INDEX IF NOT EXISTS idx_stop_times_trip_id  ON stop_times (trip_id);
CREATE INDEX IF NOT EXISTS idx_trips_route_id      ON trips (route_id);
CREATE INDEX IF NOT EXISTS idx_trips_service_id    ON trips (service_id);

-- Spatial-ish index on stops for "near me" queries.
-- Postgres doesn't natively support geographic distance ordering without PostGIS,
-- so the API implements a bounding-box pre-filter using lat/lon ranges + Haversine
-- in application code. These indexes accelerate the lat/lon range scan.
CREATE INDEX IF NOT EXISTS idx_stops_lat ON stops (stop_lat);
CREATE INDEX IF NOT EXISTS idx_stops_lon ON stops (stop_lon);
