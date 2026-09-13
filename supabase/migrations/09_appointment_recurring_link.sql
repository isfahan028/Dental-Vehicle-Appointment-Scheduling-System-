-- ============================================================
-- Migration 09: link generated appointments back to their recurring request
-- Run in: Supabase Dashboard -> SQL Editor  (no CLI needed)
-- Safe to run multiple times.
-- ============================================================
--
-- WHY THIS EXISTS
-- Approving a recurring request creates several individual appointments
-- (one per month). To let an admin correct the price for the WHOLE series
-- in one action (instead of editing each month one by one), each generated
-- appointment needs to record which request it came from.
--
-- NOTE: this only applies going forward. Appointments created by requests
-- approved BEFORE this migration have no link and won't be picked up by the
-- bulk price edit — they can still be corrected individually from the
-- Appointments tab.
-- ============================================================

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS recurring_request_id INT
    REFERENCES recurring_requests(request_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_recurring_request_id
  ON appointments(recurring_request_id);

-- ============================================================
-- Verify:
--   select column_name from information_schema.columns
--   where table_name = 'appointments' and column_name = 'recurring_request_id';
-- ============================================================
