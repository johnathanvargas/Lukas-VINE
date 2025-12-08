-- =========================================================
-- Request-for-Diagnosis System Database Schema
-- =========================================================
-- This migration creates the tables and policies for the
-- request-for-diagnosis system integrated with Supabase.
-- =========================================================

-- Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- REQUESTS TABLE
-- =========================================================
-- Stores plant diagnosis requests submitted by users
-- Supports both authenticated and anonymous submissions
-- =========================================================

CREATE TABLE IF NOT EXISTS requests (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reporter information
  -- reporter_id: references auth.users(id) for authenticated users, NULL for anonymous
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name TEXT NOT NULL,
  contact TEXT NOT NULL, -- email or phone number
  
  -- Request details
  plant_type TEXT NOT NULL,
  symptoms TEXT NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  
  -- Images stored as array of public URLs from Supabase Storage
  images JSONB DEFAULT '[]'::jsonb,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'in-progress', 'resolved', 'closed')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_requests_reporter_id ON requests(reporter_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to ON requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_urgency ON requests(urgency);

-- Composite index for admin queries
CREATE INDEX IF NOT EXISTS idx_requests_status_created 
  ON requests(status, created_at DESC);

-- =========================================================
-- REQUEST_COMMENTS TABLE
-- =========================================================
-- Stores comments/updates on diagnosis requests
-- =========================================================

CREATE TABLE IF NOT EXISTS request_comments (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign key to requests table
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  
  -- Comment author
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  
  -- Comment content
  comment TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false, -- internal notes vs public comments
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for comments
CREATE INDEX IF NOT EXISTS idx_comments_request_id ON request_comments(request_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON request_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON request_comments(created_at DESC);

-- =========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================
-- Note: service_role key ALWAYS bypasses RLS
-- These policies apply to authenticated users using anon key
-- =========================================================

-- Enable RLS on both tables
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_comments ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- REQUESTS TABLE POLICIES
-- =========================================================

-- Policy: Allow authenticated users to insert their own requests
-- Users can only insert requests where reporter_id matches their auth.uid()
CREATE POLICY "Users can insert own requests"
  ON requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = auth.uid() OR reporter_id IS NULL
  );

-- Policy: Allow users to view their own requests
CREATE POLICY "Users can view own requests"
  ON requests
  FOR SELECT
  TO authenticated
  USING (
    reporter_id = auth.uid()
  );

-- Policy: Allow users to update their own pending requests
CREATE POLICY "Users can update own pending requests"
  ON requests
  FOR UPDATE
  TO authenticated
  USING (
    reporter_id = auth.uid() AND status = 'pending'
  )
  WITH CHECK (
    reporter_id = auth.uid()
  );

-- Policy: Allow assigned users to view and update requests assigned to them
CREATE POLICY "Assigned users can view assigned requests"
  ON requests
  FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
  );

CREATE POLICY "Assigned users can update assigned requests"
  ON requests
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
  )
  WITH CHECK (
    assigned_to = auth.uid()
  );

-- =========================================================
-- REQUEST_COMMENTS TABLE POLICIES
-- =========================================================

-- Policy: Allow authenticated users to insert comments on their own requests
CREATE POLICY "Users can comment on own requests"
  ON request_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM requests 
      WHERE requests.id = request_comments.request_id 
        AND (requests.reporter_id = auth.uid() OR requests.assigned_to = auth.uid())
    )
  );

-- Policy: Allow users to view comments on their requests
CREATE POLICY "Users can view comments on own requests"
  ON request_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests 
      WHERE requests.id = request_comments.request_id 
        AND (requests.reporter_id = auth.uid() OR requests.assigned_to = auth.uid())
    )
    AND (is_internal = false OR user_id = auth.uid())
  );

-- Policy: Allow users to update their own comments
CREATE POLICY "Users can update own comments"
  ON request_comments
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
  );

-- =========================================================
-- TRIGGERS FOR AUTOMATIC UPDATED_AT
-- =========================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for requests table
DROP TRIGGER IF EXISTS update_requests_updated_at ON requests;
CREATE TRIGGER update_requests_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for request_comments table
DROP TRIGGER IF EXISTS update_request_comments_updated_at ON request_comments;
CREATE TRIGGER update_request_comments_updated_at
  BEFORE UPDATE ON request_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- NOTES ON SERVICE_ROLE KEY
-- =========================================================
-- The service_role key bypasses ALL RLS policies automatically.
-- Use it ONLY on the server-side (Express API) for:
--   1. Anonymous request submission (reporter_id = NULL)
--   2. Admin operations (list all requests, update any request)
--   3. Background processing and notifications
--
-- NEVER expose the service_role key to client-side code!
-- =========================================================
