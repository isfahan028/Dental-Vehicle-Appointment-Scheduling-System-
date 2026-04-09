-- ============================================================
-- Migration: KV Store → Relational SQL Schema
-- Run this in your Supabase Dashboard → SQL Editor
-- ============================================================

-- =====================
-- 1. CREATE TABLES
-- =====================

-- Users table (user_id is UUID to match Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) DEFAULT '',
  phone VARCHAR(50) DEFAULT '',
  role VARCHAR(20) NOT NULL DEFAULT 'normal_user' CHECK (role IN ('normal_user', 'admin')),
  approved_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Dental vehicles table
CREATE TABLE IF NOT EXISTS dental_vehicles (
  vehicle_id SERIAL PRIMARY KEY,
  vehicle_name VARCHAR(255) NOT NULL,
  location_name VARCHAR(255) NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT DEFAULT ''
);

-- Services table
CREATE TABLE IF NOT EXISTS services (
  service_id SERIAL PRIMARY KEY,
  service_name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  duration_minutes INT DEFAULT 30,
  price NUMERIC(10, 2) DEFAULT 0
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
  appointment_id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  vehicle_id INT NOT NULL REFERENCES dental_vehicles(vehicle_id) ON DELETE CASCADE,
  service_id INT NOT NULL REFERENCES services(service_id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Completed', 'Cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions table (for custom auth tokens)
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================
-- 2. INDEXES
-- =====================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_vehicle_id ON appointments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- =====================
-- 3. ROW LEVEL SECURITY
-- =====================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Allow the service_role key full access (our Hono server uses this)
CREATE POLICY "Service role full access on users" ON users
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on dental_vehicles" ON dental_vehicles
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on services" ON services
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on appointments" ON appointments
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on sessions" ON sessions
  FOR ALL USING (true) WITH CHECK (true);

-- =====================
-- 4. DATA MIGRATION (from kv_store_e95806c6)
-- =====================
-- This block migrates existing data from the old KV table.
-- It is safe to run multiple times (uses ON CONFLICT DO NOTHING).

-- Migrate users
INSERT INTO users (user_id, name, email, password, phone, role, created_at, is_active)
SELECT
  (value->>'id')::UUID,
  COALESCE(value->>'name', ''),
  COALESCE(value->>'email', ''),
  '',
  COALESCE(value->>'phone', ''),
  COALESCE(value->>'role', 'normal_user'),
  COALESCE((value->>'created_at')::TIMESTAMPTZ, NOW()),
  COALESCE((value->>'is_active')::BOOLEAN, TRUE)
FROM kv_store_e95806c6
WHERE key LIKE 'user:%'
ON CONFLICT (user_id) DO NOTHING;

-- Migrate dental vehicles
INSERT INTO dental_vehicles (vehicle_name, location_name, latitude, longitude, available, image_url)
SELECT
  COALESCE(value->>'name', ''),
  COALESCE(value->>'location', ''),
  (value->>'latitude')::DOUBLE PRECISION,
  (value->>'longitude')::DOUBLE PRECISION,
  COALESCE((value->>'is_available')::BOOLEAN, TRUE),
  COALESCE(value->>'image_url', '')
FROM kv_store_e95806c6
WHERE key LIKE 'vehicle:%'
ON CONFLICT DO NOTHING;

-- Migrate services
INSERT INTO services (service_name, description, duration_minutes, price)
SELECT
  COALESCE(value->>'name', ''),
  COALESCE(value->>'description', ''),
  COALESCE((value->>'duration_minutes')::INT, 30),
  COALESCE((value->>'price')::NUMERIC, 0)
FROM kv_store_e95806c6
WHERE key LIKE 'service:%'
ON CONFLICT DO NOTHING;

-- NOTE: Appointments migration requires the new integer IDs for vehicles/services.
-- Because the old system used string IDs (e.g., 'v1', 's1') while the new system uses
-- auto-increment integers, appointment migration must map old string IDs to new integer IDs.
-- This is handled below using subqueries that match by name.

-- Migrate appointments (mapping old string vehicle/service IDs to new integer IDs)
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
-- Join to find the vehicle by matching original name
LEFT JOIN kv_store_e95806c6 kv_v
  ON kv_v.key = 'vehicle:' || (a.value->>'vehicle_id')
LEFT JOIN dental_vehicles dv
  ON dv.vehicle_name = COALESCE(kv_v.value->>'name', '')
-- Join to find the service by matching original name
LEFT JOIN kv_store_e95806c6 kv_s
  ON kv_s.key = 'service:' || (a.value->>'service_id')
LEFT JOIN services s
  ON s.service_name = COALESCE(kv_s.value->>'name', '')
WHERE a.key LIKE 'appointment:%'
  AND dv.vehicle_id IS NOT NULL
  AND s.service_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- DONE! Your relational tables are ready.
-- The old kv_store_e95806c6 table has NOT been deleted.
-- You can drop it manually once you verify everything works:
--   DROP TABLE IF EXISTS kv_store_e95806c6;
-- ============================================================
