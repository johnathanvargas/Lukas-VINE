-- =========================================================
-- Treatment Logs System Database Schema
-- =========================================================
-- This migration creates the tables and policies for the
-- treatment logs system integrated with Supabase.
-- =========================================================

-- Enable pgcrypto extension for UUID generation (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- TREATMENT_LOGS TABLE
-- =========================================================
-- Stores treatment log entries submitted by employees
-- Tracks pesticide/input applications in the field
-- =========================================================

CREATE TABLE IF NOT EXISTS treatment_logs (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Employee information
  -- employee_id: references auth.users(id) for authenticated employees
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  
  -- Treatment details
  date DATE NOT NULL, -- Date of treatment application
  location TEXT NOT NULL, -- Location/zone where treatment was applied
  crop TEXT NOT NULL, -- Crop type being treated
  
  -- Treatment inputs/pesticides applied (stored as JSONB for flexibility)
  -- Example: [{"name": "Roundup", "rate": "2 qt/acre", "active_ingredient": "glyphosate"}]
  inputs JSONB DEFAULT '[]'::jsonb,
  
  -- Notes and observations
  notes TEXT, -- Additional notes about the treatment
  
  -- Photos stored as array of public URLs from Supabase Storage
  photos JSONB DEFAULT '[]'::jsonb,
  
  -- Weather data (optional, stored as JSON)
  -- Example: {"temperature": 75, "humidity": 60, "wind_speed": 5, "conditions": "partly cloudy"}
  weather JSONB,
  
  -- Metadata for additional flexible data
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_treatment_logs_employee_id ON treatment_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_treatment_logs_date ON treatment_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_treatment_logs_location ON treatment_logs(location);
CREATE INDEX IF NOT EXISTS idx_treatment_logs_crop ON treatment_logs(crop);
CREATE INDEX IF NOT EXISTS idx_treatment_logs_created_at ON treatment_logs(created_at DESC);

-- Composite index for common date + employee queries
CREATE INDEX IF NOT EXISTS idx_treatment_logs_employee_date 
  ON treatment_logs(employee_id, date DESC);

-- Composite index for location + date queries
CREATE INDEX IF NOT EXISTS idx_treatment_logs_location_date 
  ON treatment_logs(location, date DESC);

-- =========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================
-- Note: service_role key ALWAYS bypasses RLS
-- These policies apply to authenticated users using anon key
-- =========================================================

-- Enable RLS on treatment_logs table
ALTER TABLE treatment_logs ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- TREATMENT_LOGS TABLE POLICIES
-- =========================================================

-- Policy: Allow authenticated users (employees) to insert their own treatment logs
CREATE POLICY "Employees can insert own treatment logs"
  ON treatment_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
  );

-- Policy: Allow employees to view their own treatment logs
CREATE POLICY "Employees can view own treatment logs"
  ON treatment_logs
  FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid()
  );

-- Policy: Allow employees to update their own treatment logs
-- (useful for corrections within a certain timeframe)
CREATE POLICY "Employees can update own treatment logs"
  ON treatment_logs
  FOR UPDATE
  TO authenticated
  USING (
    employee_id = auth.uid()
  )
  WITH CHECK (
    employee_id = auth.uid()
  );

-- Optional: Add a policy for managers/admins to view all treatment logs
-- Uncomment if you have a role system in place:
/*
CREATE POLICY "Admins can view all treatment logs"
  ON treatment_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'manager')
    )
  );
*/

-- =========================================================
-- TRIGGERS FOR AUTOMATIC UPDATED_AT
-- =========================================================

-- Note: This migration depends on the update_updated_at_column function
-- created in 001_create_requests.sql. Ensure that migration is run first.
-- If the function doesn't exist, you can create it with:
--
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at = NOW();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- Use the existing update_updated_at_column function
-- (created in 001_create_requests.sql)
DROP TRIGGER IF EXISTS update_treatment_logs_updated_at ON treatment_logs;
CREATE TRIGGER update_treatment_logs_updated_at
  BEFORE UPDATE ON treatment_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- NOTES ON SERVICE_ROLE KEY
-- =========================================================
-- The service_role key bypasses ALL RLS policies automatically.
-- Use it ONLY on the server-side (Express API) for:
--   1. Server-side insertions (recommended for security)
--   2. Admin operations (list all logs, update any log)
--   3. Background processing and analytics
--
-- NEVER expose the service_role key to client-side code!
-- =========================================================
