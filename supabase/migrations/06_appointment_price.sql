-- ============================================================
-- Migration 06: per-appointment price
-- Run in: Supabase Dashboard -> SQL Editor  (no CLI needed)
-- Safe to run multiple times.
-- ============================================================
--
-- WHY THIS EXISTS
-- An appointment's cost used to be read live from services.price, so
-- editing a service's price silently rewrote the cost of every past
-- booking. This adds a price column that is:
--   * snapshotted from the service price when the appointment is created
--     (so history is frozen), and
--   * individually editable by an admin afterwards (a discount / surcharge
--     for one booking, one patient, one visit — without touching the
--     catalogue or anyone else's booking).
-- ============================================================

BEGIN;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);

-- Backfill existing rows with their service's current price.
UPDATE appointments a
SET price = s.price
FROM services s
WHERE a.service_id = s.service_id
  AND a.price IS NULL;

COMMIT;

-- ============================================================
-- Verify:
--   select appointment_id, service_id, price from appointments order by appointment_id;
-- ============================================================
