-- ============================================================
-- Migration 11: login history (audit log)
-- Run in: Supabase Dashboard -> SQL Editor  (no CLI needed)
-- Safe to run multiple times.
-- ============================================================
--
-- WHY THIS EXISTS
-- An audit trail of every sign-in attempt — who, when, whether it worked
-- (and if not, why), from which IP and browser — that admins can review in
-- the dashboard's "Logins" tab.
--
-- How it differs from the other two tables:
--   * sessions        — live login tokens; rows vanish on logout/expiry.
--   * login_attempts  — short-lived failure counter for the rate limit.
--   * login_history   — permanent record, never stores a token.
--
-- Only the edge function (service_role key) touches this table, so — same
-- as `users`/`sessions` — RLS is enabled with NO policies.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS login_history (
  history_id  BIGSERIAL    PRIMARY KEY,
  -- Known only for successful/deactivated sign-ins; a wrong password
  -- doesn't tell us whose account (if any) it was.
  user_id     UUID         REFERENCES users(user_id) ON DELETE SET NULL,
  email       VARCHAR(255) NOT NULL,  -- always stored lowercased
  success     BOOLEAN      NOT NULL,
  reason      VARCHAR(30)  NOT NULL
              CHECK (reason IN ('success', 'wrong_password', 'locked', 'deactivated', 'no_profile')),
  ip_address  VARCHAR(64),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON login_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_user_id    ON login_history(user_id);

ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only the edge function (service_role) touches
-- this table, exactly like `users` and `sessions`.

COMMIT;

-- ============================================================
-- Verify:
--   select table_name from information_schema.tables where table_name = 'login_history';
-- Latest sign-ins:
--   select created_at, email, success, reason, ip_address from login_history order by created_at desc limit 20;
-- ============================================================
