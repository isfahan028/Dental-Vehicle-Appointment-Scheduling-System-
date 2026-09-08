-- ============================================================
-- Migration 03: Schema Verification (READ-ONLY)
-- Run AFTER 01_create_tables.sql and 02_migrate_kv_data.sql.
-- This script makes no changes — it only queries system catalogs.
-- Run each section separately in Supabase SQL Editor and review output.
-- ============================================================

-- ========================================================
-- CHECK 1: All 5 tables exist
-- Expected: 5 rows (appointments, dental_vehicles, services, sessions, users)
-- ========================================================

SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'dental_vehicles', 'services', 'appointments', 'sessions')
ORDER BY table_name;

-- ========================================================
-- CHECK 2: Column definitions for every table
-- Review: data types, nullability, defaults all match the app's db.tsx expectations
-- ========================================================

SELECT
  table_name,
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('users', 'dental_vehicles', 'services', 'appointments', 'sessions')
ORDER BY table_name, ordinal_position;

-- ========================================================
-- CHECK 3: All indexes are present
-- Expected indexes:
--   idx_users_email, idx_appointments_user_id, idx_appointments_vehicle_id,
--   idx_appointments_date, idx_sessions_user_id
--   (plus automatic PK indexes on all tables)
-- ========================================================

SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('users', 'dental_vehicles', 'services', 'appointments', 'sessions')
ORDER BY tablename, indexname;

-- ========================================================
-- CHECK 4: RLS is enabled on all 5 tables
-- Expected: all rows show rls_enabled = TRUE
-- ========================================================

SELECT
  relname          AS table_name,
  relrowsecurity   AS rls_enabled
FROM pg_class
WHERE relname IN ('users', 'dental_vehicles', 'services', 'appointments', 'sessions')
  AND relkind = 'r'
ORDER BY relname;

-- ========================================================
-- CHECK 5: RLS policies exist on all 5 tables
-- Expected: 5 rows, one policy per table
-- ========================================================

SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('users', 'dental_vehicles', 'services', 'appointments', 'sessions')
ORDER BY tablename, policyname;

-- ========================================================
-- CHECK 6: Foreign key constraints and their delete behaviour
-- Expected:
--   appointments.user_id    → users.user_id         (CASCADE)
--   appointments.vehicle_id → dental_vehicles.vehicle_id (CASCADE)
--   appointments.service_id → services.service_id   (CASCADE)
--   sessions.user_id        → users.user_id         (CASCADE)
--   users.approved_by       → users.user_id         (SET NULL)
-- ========================================================

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name  AS references_table,
  ccu.column_name AS references_column,
  rc.delete_rule
FROM information_schema.table_constraints        AS tc
JOIN information_schema.key_column_usage         AS kcu ON tc.constraint_name = kcu.constraint_name
                                                       AND tc.table_schema    = kcu.table_schema
JOIN information_schema.constraint_column_usage  AS ccu ON ccu.constraint_name = tc.constraint_name
                                                       AND ccu.table_schema    = tc.table_schema
JOIN information_schema.referential_constraints  AS rc  ON rc.constraint_name  = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema    = 'public'
  AND tc.table_name IN ('users', 'dental_vehicles', 'services', 'appointments', 'sessions')
ORDER BY tc.table_name, kcu.column_name;

-- ========================================================
-- CHECK 7: CHECK constraints (role, status enums)
-- Expected:
--   users.role   IN ('normal_user', 'admin')
--   appointments.status IN ('Pending', 'Approved', 'Completed', 'Cancelled')
-- ========================================================

SELECT
  cc.constraint_name,
  tc.table_name,
  cc.check_clause
FROM information_schema.check_constraints  AS cc
JOIN information_schema.table_constraints  AS tc
  ON tc.constraint_name  = cc.constraint_name
 AND tc.constraint_schema = cc.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name   IN ('users', 'dental_vehicles', 'services', 'appointments', 'sessions')
ORDER BY tc.table_name, cc.constraint_name;

-- ========================================================
-- CHECK 8: Row counts — confirms data migration worked
-- Expected (if KV data existed): non-zero counts for users, vehicles, services
-- sessions will be 0 (no active sessions yet)
-- ========================================================

SELECT 'users'           AS table_name, COUNT(*) AS row_count FROM users
UNION ALL
SELECT 'dental_vehicles',               COUNT(*)              FROM dental_vehicles
UNION ALL
SELECT 'services',                      COUNT(*)              FROM services
UNION ALL
SELECT 'appointments',                  COUNT(*)              FROM appointments
UNION ALL
SELECT 'sessions',                      COUNT(*)              FROM sessions
ORDER BY table_name;

-- ============================================================
-- All checks passed? You're ready to deploy!
-- Call GET /make-server-e95806c6/health/db to verify from the app.
-- ============================================================
