-- =====================================================
-- Migration 013: Performance Baselines for Regression Detection
-- =====================================================
-- Prerequisites: 009_add_organizations.sql, 010_add_rls_policies.sql
--
-- This migration adds performance baseline tracking to detect
-- when tests become slower than their historical average.

-- 1. Create performance baselines table
CREATE TABLE IF NOT EXISTS test_performance_baselines (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  test_signature TEXT NOT NULL,
  test_name TEXT NOT NULL,
  test_file TEXT NOT NULL,
  baseline_duration_ms INTEGER NOT NULL,
  p50_duration_ms INTEGER,
  p95_duration_ms INTEGER,
  sample_count INTEGER DEFAULT 0,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, test_signature)
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_perf_baselines_org_id
  ON test_performance_baselines(organization_id);

CREATE INDEX IF NOT EXISTS idx_perf_baselines_org_sig
  ON test_performance_baselines(organization_id, test_signature);

CREATE INDEX IF NOT EXISTS idx_perf_baselines_updated
  ON test_performance_baselines(last_updated_at DESC);

-- 3. Enable Row-Level Security
ALTER TABLE test_performance_baselines ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Users can view their org's baselines
CREATE POLICY "perf_baselines_select_org_member"
  ON test_performance_baselines FOR SELECT
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- 5. RLS Policy: Service accounts and admins can insert
CREATE POLICY "perf_baselines_insert_service"
  ON test_performance_baselines FOR INSERT
  WITH CHECK (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- 6. RLS Policy: Service accounts and admins can update
CREATE POLICY "perf_baselines_update_service"
  ON test_performance_baselines FOR UPDATE
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- 7. RLS Policy: Admins can delete (for baseline reset)
CREATE POLICY "perf_baselines_delete_admin"
  ON test_performance_baselines FOR DELETE
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
  );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- 1. Check table was created:
-- SELECT * FROM information_schema.tables WHERE table_name = 'test_performance_baselines';

-- 2. Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'test_performance_baselines';

-- 3. List policies:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'test_performance_baselines';
