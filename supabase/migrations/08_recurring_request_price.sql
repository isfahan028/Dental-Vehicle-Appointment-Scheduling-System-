-- ============================================================
-- Migration 08: special price for a recurring request
-- Run in: Supabase Dashboard -> SQL Editor  (no CLI needed)
-- Safe to run multiple times.
-- ============================================================
--
-- WHY THIS EXISTS
-- An admin approving a recurring request may want to offer a discounted
-- monthly rate for committing to several months (a "package" price),
-- without touching the service catalogue or any other booking. This adds
-- an optional column: NULL means "use whatever the service's catalogue
-- price is at approval time" (today's behaviour, unchanged); a value means
-- every appointment generated for this request uses that price instead.
-- ============================================================

ALTER TABLE recurring_requests
  ADD COLUMN IF NOT EXISTS agreed_price NUMERIC(10, 2);

-- ============================================================
-- Verify:
--   select column_name, data_type from information_schema.columns
--   where table_name = 'recurring_requests' and column_name = 'agreed_price';
-- ============================================================
