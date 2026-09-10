-- ============================================================
-- Migration 05: One active appointment per vehicle / date / time
-- Run in: Supabase Dashboard -> SQL Editor  (no CLI needed)
-- Safe to run multiple times.
-- ============================================================
--
-- WHY THIS EXISTS
-- The edge function checks `hasAppointmentConflict` before inserting, but that
-- check-then-insert is not atomic: two requests for the same slot can both pass
-- the check and both insert, producing a double-booking (and the confusing
-- "Appointment booked!" + "slot already taken" whiplash in the UI).
--
-- This partial unique index makes the database the single source of truth.
-- A second active booking for the same (vehicle, date, time) fails with
-- SQLSTATE 23505, which the edge function converts into a clean 409.
-- Cancelled appointments are excluded, so a cancelled slot frees up again.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_appointment_slot
  ON appointments (vehicle_id, appointment_date, appointment_time)
  WHERE status <> 'Cancelled';

-- ============================================================
-- Verify:
--   select indexname, indexdef
--   from pg_indexes
--   where tablename = 'appointments';        -- expect uniq_active_appointment_slot
--
-- NOTE: if this errors with "could not create unique index ... is duplicated",
-- you already have double-booked rows. Find them with:
--   select vehicle_id, appointment_date, appointment_time, count(*)
--   from appointments
--   where status <> 'Cancelled'
--   group by 1, 2, 3
--   having count(*) > 1;
-- Cancel or delete the extras, then re-run this migration.
-- ============================================================
