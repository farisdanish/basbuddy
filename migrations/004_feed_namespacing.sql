-- Migration 004: Multi-Feed GTFS Namespacing & Composite Keys
-- Enables multiple transit feeds (rapid-bus-kl, rapid-bus-mrtfeeder, rapid-rail-kl, smart-selangor)
-- to coexist safely in PostgreSQL without ID collisions or cross-feed data corruption.

-- ── 1. Drop existing Foreign Key constraints ─────────────────────────────────
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_stop_id_fkey;
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_route_id_fkey;
ALTER TABLE stop_times DROP CONSTRAINT IF EXISTS stop_times_trip_id_fkey;
ALTER TABLE stop_times DROP CONSTRAINT IF EXISTS stop_times_stop_id_fkey;
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_route_id_fkey;
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_service_id_fkey;

-- ── 2. Add feed_id columns with default 'rapid-bus-kl' ───────────────────────
ALTER TABLE routes ADD COLUMN IF NOT EXISTS feed_id TEXT NOT NULL DEFAULT 'rapid-bus-kl';
ALTER TABLE stops ADD COLUMN IF NOT EXISTS feed_id TEXT NOT NULL DEFAULT 'rapid-bus-kl';
ALTER TABLE calendar ADD COLUMN IF NOT EXISTS feed_id TEXT NOT NULL DEFAULT 'rapid-bus-kl';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS feed_id TEXT NOT NULL DEFAULT 'rapid-bus-kl';
ALTER TABLE shapes ADD COLUMN IF NOT EXISTS feed_id TEXT NOT NULL DEFAULT 'rapid-bus-kl';
ALTER TABLE stop_times ADD COLUMN IF NOT EXISTS feed_id TEXT NOT NULL DEFAULT 'rapid-bus-kl';
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS feed_id TEXT NOT NULL DEFAULT 'rapid-bus-kl';

-- ── 3. Re-create composite Primary Keys ──────────────────────────────────────
ALTER TABLE routes DROP CONSTRAINT IF EXISTS routes_pkey;
ALTER TABLE routes ADD PRIMARY KEY (feed_id, route_id);

ALTER TABLE stops DROP CONSTRAINT IF EXISTS stops_pkey;
ALTER TABLE stops ADD PRIMARY KEY (feed_id, stop_id);

ALTER TABLE calendar DROP CONSTRAINT IF EXISTS calendar_pkey;
ALTER TABLE calendar ADD PRIMARY KEY (feed_id, service_id);

ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_pkey;
ALTER TABLE trips ADD PRIMARY KEY (feed_id, trip_id);

ALTER TABLE shapes DROP CONSTRAINT IF EXISTS shapes_pkey;
ALTER TABLE shapes ADD PRIMARY KEY (feed_id, shape_id, shape_pt_sequence);

ALTER TABLE stop_times DROP CONSTRAINT IF EXISTS stop_times_pkey;
ALTER TABLE stop_times ADD PRIMARY KEY (feed_id, trip_id, stop_sequence);

-- ── 4. Re-create composite Foreign Key constraints ───────────────────────────
ALTER TABLE trips ADD CONSTRAINT trips_route_fkey FOREIGN KEY (feed_id, route_id) REFERENCES routes (feed_id, route_id) ON DELETE CASCADE;
ALTER TABLE trips ADD CONSTRAINT trips_calendar_fkey FOREIGN KEY (feed_id, service_id) REFERENCES calendar (feed_id, service_id) ON DELETE CASCADE;

ALTER TABLE stop_times ADD CONSTRAINT stop_times_trip_fkey FOREIGN KEY (feed_id, trip_id) REFERENCES trips (feed_id, trip_id) ON DELETE CASCADE;
ALTER TABLE stop_times ADD CONSTRAINT stop_times_stop_fkey FOREIGN KEY (feed_id, stop_id) REFERENCES stops (feed_id, stop_id) ON DELETE CASCADE;

ALTER TABLE favorites ADD CONSTRAINT favorites_stop_fkey FOREIGN KEY (feed_id, stop_id) REFERENCES stops (feed_id, stop_id) ON DELETE CASCADE;
ALTER TABLE favorites ADD CONSTRAINT favorites_route_fkey FOREIGN KEY (feed_id, route_id) REFERENCES routes (feed_id, route_id) ON DELETE SET NULL;

-- ── 5. Add multi-feed query acceleration indexes ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_routes_feed ON routes (feed_id);
CREATE INDEX IF NOT EXISTS idx_stops_feed ON stops (feed_id);
CREATE INDEX IF NOT EXISTS idx_trips_feed_route ON trips (feed_id, route_id);
CREATE INDEX IF NOT EXISTS idx_trips_feed_service ON trips (feed_id, service_id);
CREATE INDEX IF NOT EXISTS idx_stop_times_feed_stop ON stop_times (feed_id, stop_id);
CREATE INDEX IF NOT EXISTS idx_stop_times_feed_trip ON stop_times (feed_id, trip_id);
CREATE INDEX IF NOT EXISTS idx_shapes_feed_shape ON shapes (feed_id, shape_id);
CREATE INDEX IF NOT EXISTS idx_favorites_feed_stop ON favorites (feed_id, stop_id);
CREATE INDEX IF NOT EXISTS idx_favorites_feed_route ON favorites (feed_id, route_id);
