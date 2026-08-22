-- Migration 002: Allow route-only favorites (nullable stop_id)
-- Commuters can now favorite routes as well as stops.

ALTER TABLE favorites ALTER COLUMN stop_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_favorite_target'
  ) THEN
    ALTER TABLE favorites ADD CONSTRAINT chk_favorite_target CHECK (stop_id IS NOT NULL OR route_id IS NOT NULL);
  END IF;
END $$;
