-- =====================================================
-- Migration 010: Row-Level Security for Multi-Tenancy
-- =====================================================
--
-- IMPORTANT: This migration provides DATABASE-LEVEL security
-- as an additional layer on top of application-level filtering.
--
-- PREREQUISITES:
--   1. Migration 009_add_organizations.sql must be complete
--   2. Neon Auth must be configured with auth.email() function
--   3. Test thoroughly in staging before production
--
-- RISKS:
--   - If auth.email() is not available, queries return empty results
--   - CI/CD ingestion uses API keys, not user sessions - needs bypass
--   - May impact query performance - monitor after enabling
--
-- ROLLBACK:
--   ALTER TABLE test_executions DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE test_results DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE test_artifacts DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE test_flakiness_history DISABLE ROW LEVEL SECURITY;
--
-- =====================================================

-- Step 1: Create helper function for safer auth.email() access
-- Returns NULL if auth.email() is not available (prevents query failures)
CREATE OR REPLACE FUNCTION safe_auth_email()
RETURNS TEXT AS $$
BEGIN
  -- Try to get the authenticated user's email
  -- Returns NULL if not in an authenticated context
  RETURN auth.email();
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create helper function to check if user is org member
CREATE OR REPLACE FUNCTION is_org_member(target_org_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  -- If no auth context, deny access
  IF safe_auth_email() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is member of the organization
  RETURN EXISTS (
    SELECT 1 
    FROM organization_members om
    JOIN dashboard_users u ON u.id = om.user_id
    WHERE u.email = safe_auth_email()
      AND om.organization_id = target_org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create helper function to check if user is system admin
CREATE OR REPLACE FUNCTION is_system_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- If no auth context, deny access
  IF safe_auth_email() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user has admin role
  RETURN EXISTS (
    SELECT 1 
    FROM dashboard_users
    WHERE email = safe_auth_email()
      AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create helper function to check if running as service account
-- This allows CI/CD to bypass RLS when using API key auth
CREATE OR REPLACE FUNCTION is_service_account()
RETURNS BOOLEAN AS $$
BEGIN
  -- Service accounts run without auth context (API key only)
  -- If auth.email() returns NULL, could be service account
  -- Check for a specific session variable that API routes can set
  RETURN current_setting('app.is_service_account', TRUE) = 'true';
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- ===== test_executions =====

-- Enable RLS on test_executions
ALTER TABLE test_executions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their organization's executions
CREATE POLICY "test_executions_select_org_member"
  ON test_executions FOR SELECT
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- Policy: Service accounts can insert (for CI/CD)
CREATE POLICY "test_executions_insert_service"
  ON test_executions FOR INSERT
  WITH CHECK (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- Policy: Updates allowed for org admins or system admins
CREATE POLICY "test_executions_update_admin"
  ON test_executions FOR UPDATE
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- ===== test_results =====

-- Enable RLS on test_results
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view results if they can view the execution
CREATE POLICY "test_results_select_via_execution"
  ON test_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM test_executions te
      WHERE te.id = test_results.execution_id
        AND (
          is_org_member(te.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

-- Policy: Service accounts can insert
CREATE POLICY "test_results_insert_service"
  ON test_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM test_executions te
      WHERE te.id = execution_id
        AND (
          is_org_member(te.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

-- ===== test_artifacts =====

-- Enable RLS on test_artifacts
ALTER TABLE test_artifacts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view artifacts if they can view the test result
CREATE POLICY "test_artifacts_select_via_result"
  ON test_artifacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM test_results tr
      JOIN test_executions te ON te.id = tr.execution_id
      WHERE tr.id = test_artifacts.test_result_id
        AND (
          is_org_member(te.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

-- Policy: Service accounts can insert
CREATE POLICY "test_artifacts_insert_service"
  ON test_artifacts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM test_results tr
      JOIN test_executions te ON te.id = tr.execution_id
      WHERE tr.id = test_result_id
        AND (
          is_org_member(te.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

-- ===== test_flakiness_history =====

-- Enable RLS on test_flakiness_history
ALTER TABLE test_flakiness_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their org's flakiness data
CREATE POLICY "test_flakiness_select_org_member"
  ON test_flakiness_history FOR SELECT
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- Policy: Service accounts can insert/update
CREATE POLICY "test_flakiness_insert_service"
  ON test_flakiness_history FOR INSERT
  WITH CHECK (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

CREATE POLICY "test_flakiness_update_service"
  ON test_flakiness_history FOR UPDATE
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these after migration to verify RLS is working:

-- 1. Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE tablename IN ('test_executions', 'test_results', 'test_artifacts', 'test_flakiness_history');

-- 2. List policies:
-- SELECT schemaname, tablename, policyname, cmd FROM pg_policies 
-- WHERE tablename LIKE 'test_%';

-- 3. Test as authenticated user (should return only their org's data):
-- SELECT count(*) FROM test_executions;

-- =====================================================
-- NOTES
-- =====================================================
-- 
-- To set service account context in API routes:
--   await sql`SET LOCAL app.is_service_account = 'true'`
--
-- This must be done within the same transaction/connection
-- that performs the data operations.
