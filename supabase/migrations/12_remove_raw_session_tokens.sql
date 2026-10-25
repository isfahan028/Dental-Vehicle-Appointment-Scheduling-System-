-- ============================================================
-- Migration 12: remove plaintext session tokens
-- Run in: Supabase Dashboard -> SQL Editor  (no CLI needed)
-- Run AFTER deploying the edge function that hashes tokens.
-- Safe to run multiple times.
-- ============================================================
--
-- WHY THIS EXISTS
-- The edge function now stores only a SHA-256 hash of each session token
-- (64 lowercase hex characters, no "mts_" prefix). Rows written before that
-- hold the real token, which (a) can no longer match any lookup, so they
-- are dead, and (b) would let anyone who sees this table hijack the
-- account if the token is still within its 7 days. Delete them.
--
-- Effect: anyone still logged in with an old token is signed out once and
-- simply logs in again. Their login history (login_history) is untouched.
-- ============================================================

BEGIN;

DELETE FROM sessions
WHERE token !~ '^[0-9a-f]{64}$';

COMMIT;

-- ============================================================
-- Verify (should return 0):
--   select count(*) from sessions where token !~ '^[0-9a-f]{64}$';
-- ============================================================
