-- Migration 003: Device-scoped favorites
-- Adds device_id to favorites table so favorites are scoped per client/device.

ALTER TABLE favorites ADD COLUMN IF NOT EXISTS device_id TEXT NOT NULL DEFAULT 'legacy';
CREATE INDEX IF NOT EXISTS idx_favorites_device_id ON favorites(device_id);

-- One-time safe cleanup of unowned legacy test rows
DELETE FROM favorites WHERE device_id = 'legacy';

ALTER TABLE favorites ALTER COLUMN device_id DROP DEFAULT;
