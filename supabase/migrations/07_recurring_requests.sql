-- ============================================================
-- Migration 07: recurring appointment requests
-- Run in: Supabase Dashboard -> SQL Editor  (no CLI needed)
-- Safe to run multiple times.
-- ============================================================
--
-- WHY THIS EXISTS
-- A patient who wants a monthly recurring visit (like a standing dental
-- check-up) doesn't book each month directly. They submit a REQUEST
-- (service, vehicle, first date/time, how many months) that sits Pending
-- until an admin approves it (standing in for the dentist's sign-off) or
-- rejects it. Approving generates the actual appointments — one per month,
-- skipping any month whose slot is already taken by someone else.
--
-- This table only ever gets touched through the edge function (service_role
-- key), so — same as `users`/`sessions` — RLS is enabled with NO policies:
-- locked out for anon/authenticated by default.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS recurring_requests (
  request_id       SERIAL      PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  vehicle_id       INT         NOT NULL REFERENCES dental_vehicles(vehicle_id) ON DELETE CASCADE,
  service_id       INT         NOT NULL REFERENCES services(service_id) ON DELETE CASCADE,
  start_date       DATE        NOT NULL,
  appointment_time TIME        NOT NULL,
  months_requested INT         NOT NULL CHECK (months_requested BETWEEN 1 AND 24),
  status           VARCHAR(20) NOT NULL DEFAULT 'Pending'
                               CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  admin_note       TEXT,
  reviewed_by      UUID        REFERENCES users(user_id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_requests_user_id ON recurring_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_requests_status  ON recurring_requests(status);

ALTER TABLE recurring_requests ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only the edge function (service_role) touches
-- this table, exactly like `users` and `sessions`.

COMMIT;

-- ============================================================
-- Verify:
--   select table_name from information_schema.tables where table_name = 'recurring_requests';
-- ============================================================
