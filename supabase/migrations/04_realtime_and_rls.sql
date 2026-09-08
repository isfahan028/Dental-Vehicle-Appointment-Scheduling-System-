-- ============================================================
-- Migration 04: Realtime + least-privilege RLS
-- Run AFTER 01_create_tables.sql (and 02 if you had KV data).
-- Run in: Supabase Dashboard -> SQL Editor  (no CLI needed)
-- Safe to run multiple times.
-- ============================================================
--
-- WHY THIS EXISTS
-- The browser now holds a Supabase client (public anon key) so it can listen
-- for Postgres changes (Realtime). Migration 01 gave EVERY role full access to
-- EVERY table, which would let anyone with the anon key read the `sessions`
-- table (= session tokens = account takeover) and every user's email.
--
-- This migration replaces those blanket policies with:
--   * anon / authenticated : SELECT only, and only on data that is already
--     effectively public through the app (vehicles, services, appointments).
--   * users / sessions     : no anon access at all. The edge function uses the
--     service_role key, which bypasses RLS, so it keeps working unchanged.
--
-- NOTE on `appointments`: Realtime only delivers a changed row to a subscriber
-- whose role passes a SELECT policy, so the anon role needs SELECT here. Rows
-- contain only ids + date/time/status (no names, emails or phone numbers -
-- those are added by JOIN inside the edge function). If even that is too much
-- for your use case, drop the appointments SELECT policy below and switch the
-- Appointments page back to polling instead of Realtime.
-- ============================================================

BEGIN;

-- ---------- 1. Remove the blanket policies from migration 01 ----------
DROP POLICY IF EXISTS "Service role full access on users"           ON users;
DROP POLICY IF EXISTS "Service role full access on dental_vehicles" ON dental_vehicles;
DROP POLICY IF EXISTS "Service role full access on services"        ON services;
DROP POLICY IF EXISTS "Service role full access on appointments"    ON appointments;
DROP POLICY IF EXISTS "Service role full access on sessions"        ON sessions;

-- Make sure RLS is on everywhere (no policy + RLS on = deny for non-service_role).
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services        ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions        ENABLE ROW LEVEL SECURITY;

-- ---------- 2. Least-privilege read policies for the browser client ----------
DROP POLICY IF EXISTS "Public read vehicles"     ON dental_vehicles;
DROP POLICY IF EXISTS "Public read services"     ON services;
DROP POLICY IF EXISTS "Public read appointments" ON appointments;

CREATE POLICY "Public read vehicles"
  ON dental_vehicles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public read services"
  ON services FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public read appointments"
  ON appointments FOR SELECT
  TO anon, authenticated
  USING (true);

-- users and sessions: intentionally NO anon/authenticated policy.
-- All access to them goes through the edge function (service_role).

-- ---------- 3. Enable Realtime on the tables the app subscribes to ----------
-- The frontend only opens a channel for `appointments`. Add `dental_vehicles`
-- here too if you later want the fleet list to be push-updated instead of polled.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
  END IF;
END $$;

-- Deliver the complete old row on UPDATE/DELETE events (not just the PK).
ALTER TABLE appointments REPLICA IDENTITY FULL;

COMMIT;

-- ============================================================
-- Verify:
--   select schemaname, tablename
--   from pg_publication_tables
--   where pubname = 'supabase_realtime';     -- expect: appointments
--
--   select tablename, policyname, roles, cmd
--   from pg_policies
--   where schemaname = 'public'
--   order by tablename;                       -- expect reads on vehicles/services/appointments only
-- ============================================================
