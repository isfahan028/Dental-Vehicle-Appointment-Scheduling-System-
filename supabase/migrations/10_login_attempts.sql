-- ============================================================
-- Migration 10: failed login attempts (login rate limiting)
-- Run in: Supabase Dashboard -> SQL Editor  (no CLI needed)
-- Safe to run multiple times.
-- ============================================================
--
-- WHY THIS EXISTS
-- Without a limit, anyone can try passwords against an account as fast as
-- they like (brute force / credential stuffing). The edge function now
-- records every FAILED sign-in here and refuses further attempts once an
-- email (5) or an IP address (20) has too many failures in the last
-- 15 minutes. A successful sign-in clears that email's failures.
--
-- Rows older than a day are deleted by the edge function as it goes, so
-- the table stays small without a cron job.
--
-- Only the edge function (service_role key) touches this table, so — same
-- as `users`/`sessions` — RLS is enabled with NO policies.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_id   BIGSERIAL    PRIMARY KEY,
  email        VARCHAR(255) NOT NULL,  -- always stored lowercased
  ip_address   VARCHAR(64),
  attempted_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts(email, attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time    ON login_attempts(ip_address, attempted_at);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only the edge function (service_role) touches
-- this table, exactly like `users` and `sessions`.

COMMIT;

-- ============================================================
-- Verify:
--   select table_name from information_schema.tables where table_name = 'login_attempts';
-- Unlock someone early (e.g. a locked-out admin):
--   delete from login_attempts where email = 'someone@example.com';
-- ============================================================
