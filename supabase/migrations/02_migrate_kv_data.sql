-- ============================================================
-- Migration 02: Data Migration from KV Store → Relational Tables
-- Prerequisites: 01_create_tables.sql must have been run first.
-- Safe to run multiple times (ON CONFLICT DO NOTHING on every INSERT).
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================
-- This script reads from the old kv_store_e95806c6 table.
-- If that table does not exist, this script will error — skip it in that case.
-- ============================================================

BEGIN;

-- ========================================================
-- Step 1: Migrate Users
-- KV key pattern: "user:<uuid>"
-- JSON shape: { id, name, email, phone, role, created_at, is_active }
-- ========================================================

INSERT INTO users (user_id, name, email, password, phone, role, created_at, is_active)
SELECT
  (value->>'id')::UUID,
  COALESCE(value->>'name',       ''),
  COALESCE(value->>'email',      ''),
  '',                                                            -- password managed by Supabase Auth
  COALESCE(value->>'phone',      ''),
  COALESCE(value->>'role',       'normal_user'),
  COALESCE((value->>'created_at')::TIMESTAMPTZ, NOW()),
  COALESCE((value->>'is_active')::BOOLEAN,      TRUE)
FROM kv_store_e95806c6
WHERE key LIKE 'user:%'
ON CONFLICT (user_id) DO NOTHING;

-- ========================================================
-- Step 2: Migrate Dental Vehicles
-- KV key pattern: "vehicle:<id>"
-- JSON shape: { name, location, latitude, longitude, is_available, image_url }
-- ========================================================

INSERT INTO dental_vehicles (vehicle_name, location_name, latitude, longitude, available, image_url)
SELECT
  COALESCE(value->>'name',     ''),
  COALESCE(value->>'location', ''),
  NULLIF(value->>'latitude',   '')::DOUBLE PRECISION,
  NULLIF(value->>'longitude',  '')::DOUBLE PRECISION,
  COALESCE((value->>'is_available')::BOOLEAN, TRUE),
  COALESCE(value->>'image_url', '')
FROM kv_store_e95806c6
WHERE key LIKE 'vehicle:%'
ON CONFLICT DO NOTHING;

-- ========================================================
-- Step 3: Migrate Services
-- KV key pattern: "service:<id>"
-- JSON shape: { name, description, duration_minutes, price }
-- ========================================================

INSERT INTO services (service_name, description, duration_minutes, price)
SELECT
  COALESCE(value->>'name',        ''),
  COALESCE(value->>'description', ''),
  COALESCE(NULLIF(value->>'duration_minutes', '')::INT,     30),
  COALESCE(NULLIF(value->>'price',            '')::NUMERIC,  0)
FROM kv_store_e95806c6
WHERE key LIKE 'service:%'
ON CONFLICT DO NOTHING;

-- ========================================================
-- Step 4: Migrate Appointments
-- KV key pattern: "appointment:<id>"
-- JSON shape: { user_id, vehicle_id, service_id, date, time, status, created_at }
--
-- IMPORTANT: The old system used opaque string IDs for vehicles and services
-- (e.g. "v1", "s1"), while the new system uses auto-increment integers.
-- This migration resolves the old string IDs by:
--   1. Looking up the KV entry for the referenced vehicle/service
--   2. Matching by name to find the new integer ID
--
-- Appointments that reference vehicles/services not yet migrated are skipped.
-- ========================================================

INSERT INTO appointments (user_id, vehicle_id, service_id, appointment_date, appointment_time, status, created_at)
SELECT
  (a.value->>'user_id')::UUID,
  dv.vehicle_id,
  s.service_id,
  (a.value->>'date')::DATE,
  (a.value->>'time')::TIME,
  COALESCE(a.value->>'status', 'Pending'),
  COALESCE((a.value->>'created_at')::TIMESTAMPTZ, NOW())
FROM kv_store_e95806c6 a

-- Resolve old vehicle_id string → vehicle KV entry → matched relational row
LEFT JOIN kv_store_e95806c6 kv_v
  ON kv_v.key = 'vehicle:' || (a.value->>'vehicle_id')
LEFT JOIN dental_vehicles dv
  ON dv.vehicle_name = COALESCE(kv_v.value->>'name', '')

-- Resolve old service_id string → service KV entry → matched relational row
LEFT JOIN kv_store_e95806c6 kv_s
  ON kv_s.key = 'service:' || (a.value->>'service_id')
LEFT JOIN services s
  ON s.service_name = COALESCE(kv_s.value->>'name', '')

WHERE a.key LIKE 'appointment:%'
  AND dv.vehicle_id IS NOT NULL   -- skip if vehicle not migrated
  AND s.service_id  IS NOT NULL   -- skip if service not migrated

ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================
-- Migration 02 complete.
-- Next step: run 03_verify_schema.sql to confirm row counts
-- and validate all constraints are in place.
-- ============================================================
