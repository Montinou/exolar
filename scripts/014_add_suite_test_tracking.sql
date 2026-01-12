-- =====================================================
-- Migration 014: Suite and Test Tracking
-- =====================================================
--
-- PREREQUISITES:
--   1. Migration 009_add_organizations.sql (organizations table)
--   2. Migration 010_add_rls_policies.sql (RLS helper functions)
--
-- PURPOSE:
--   - org_suites: Register known suites per organization with tech stack
--   - suite_tests: Track individual tests per suite with activity status
--   - Auto-discovery during CI/CD ingestion
--   - Track tests that no longer run (inactive after 30 days)
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS suite_tests CASCADE;
--   DROP TABLE IF EXISTS org_suites CASCADE;
--   ALTER TABLE test_executions DROP COLUMN IF EXISTS suite_id;
--
-- =====================================================

-- =====================================================
-- 1. Create org_suites table
-- =====================================================
CREATE TABLE IF NOT EXISTS org_suites (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                             -- Suite name (matches test_executions.suite)
  tech_stack TEXT NOT NULL DEFAULT 'playwright',  -- playwright, cypress, vitest, jest, mocha, pytest, other
  description TEXT,                               -- Optional description
  repository_url TEXT,                            -- Optional link to repo
  is_active BOOLEAN NOT NULL DEFAULT true,        -- Whether suite is actively used
  test_count INTEGER NOT NULL DEFAULT 0,          -- Cached count of active tests in suite
  last_execution_id INTEGER,                      -- Will add FK after table exists
  last_execution_at TIMESTAMP WITH TIME ZONE,
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Add FK for last_execution_id (after table exists)
ALTER TABLE org_suites
ADD CONSTRAINT fk_org_suites_last_execution
FOREIGN KEY (last_execution_id)
REFERENCES test_executions(id) ON DELETE SET NULL;

-- Valid tech_stack values
ALTER TABLE org_suites
ADD CONSTRAINT org_suites_tech_stack_check
CHECK (tech_stack IN ('playwright', 'cypress', 'vitest', 'jest', 'mocha', 'pytest', 'other'));

COMMENT ON TABLE org_suites IS 'Registry of test suites per organization with tech stack and metadata';
COMMENT ON COLUMN org_suites.tech_stack IS 'Test framework: playwright, cypress, vitest, jest, mocha, pytest, other';
COMMENT ON COLUMN org_suites.test_count IS 'Cached count of active tests (updated on ingestion)';

-- =====================================================
-- 2. Create suite_tests table
-- =====================================================
CREATE TABLE IF NOT EXISTS suite_tests (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  suite_id INTEGER REFERENCES org_suites(id) ON DELETE SET NULL,  -- NULL if no suite assigned
  test_signature TEXT NOT NULL,                   -- MD5(file::name) - matches test_results.test_signature
  test_name TEXT NOT NULL,
  test_file TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,        -- Inactive if not seen in 30 days
  is_critical BOOLEAN NOT NULL DEFAULT false,     -- Inherits from test_results.is_critical
  run_count INTEGER NOT NULL DEFAULT 0,           -- Total runs
  pass_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  skip_count INTEGER NOT NULL DEFAULT 0,
  last_status TEXT,                               -- passed, failed, skipped, timedout
  last_duration_ms INTEGER,
  avg_duration_ms INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, test_signature)
);

-- Add CHECK constraint for last_status
ALTER TABLE suite_tests
ADD CONSTRAINT suite_tests_status_check
CHECK (last_status IS NULL OR last_status IN ('passed', 'failed', 'skipped', 'timedout'));

COMMENT ON TABLE suite_tests IS 'Individual test tracking with activity status and run statistics';
COMMENT ON COLUMN suite_tests.is_active IS 'False if test has not run in 30 days';
COMMENT ON COLUMN suite_tests.test_signature IS 'MD5(file::name) - matches test_results.test_signature';

-- =====================================================
-- 3. Add suite_id FK to test_executions
-- =====================================================
ALTER TABLE test_executions
ADD COLUMN IF NOT EXISTS suite_id INTEGER REFERENCES org_suites(id) ON DELETE SET NULL;

COMMENT ON COLUMN test_executions.suite_id IS 'FK to org_suites for structured suite tracking';

-- =====================================================
-- 4. Create indexes for performance
-- =====================================================

-- org_suites indexes
CREATE INDEX IF NOT EXISTS idx_org_suites_org_id
  ON org_suites(organization_id);

CREATE INDEX IF NOT EXISTS idx_org_suites_tech_stack
  ON org_suites(organization_id, tech_stack);

CREATE INDEX IF NOT EXISTS idx_org_suites_last_exec
  ON org_suites(last_execution_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_org_suites_active
  ON org_suites(organization_id) WHERE is_active = true;

-- suite_tests indexes
CREATE INDEX IF NOT EXISTS idx_suite_tests_org_id
  ON suite_tests(organization_id);

CREATE INDEX IF NOT EXISTS idx_suite_tests_suite_id
  ON suite_tests(suite_id);

CREATE INDEX IF NOT EXISTS idx_suite_tests_signature
  ON suite_tests(organization_id, test_signature);

CREATE INDEX IF NOT EXISTS idx_suite_tests_active
  ON suite_tests(organization_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_suite_tests_inactive
  ON suite_tests(organization_id) WHERE is_active = false;

CREATE INDEX IF NOT EXISTS idx_suite_tests_last_seen
  ON suite_tests(last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_suite_tests_file
  ON suite_tests(organization_id, test_file);

-- test_executions suite_id index
CREATE INDEX IF NOT EXISTS idx_test_executions_suite_id
  ON test_executions(suite_id);

-- =====================================================
-- 5. Enable Row-Level Security
-- =====================================================

ALTER TABLE org_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE suite_tests ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. RLS Policies for org_suites
-- =====================================================

-- Policy: Users can view their org's suites
CREATE POLICY "org_suites_select_org_member"
  ON org_suites FOR SELECT
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- Policy: Service accounts and org members can insert
CREATE POLICY "org_suites_insert_service"
  ON org_suites FOR INSERT
  WITH CHECK (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- Policy: Service accounts and org members can update
CREATE POLICY "org_suites_update_service"
  ON org_suites FOR UPDATE
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- Policy: Admins can delete suites
CREATE POLICY "org_suites_delete_admin"
  ON org_suites FOR DELETE
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
  );

-- =====================================================
-- 7. RLS Policies for suite_tests
-- =====================================================

-- Policy: Users can view their org's tests
CREATE POLICY "suite_tests_select_org_member"
  ON suite_tests FOR SELECT
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- Policy: Service accounts and org members can insert
CREATE POLICY "suite_tests_insert_service"
  ON suite_tests FOR INSERT
  WITH CHECK (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- Policy: Service accounts and org members can update
CREATE POLICY "suite_tests_update_service"
  ON suite_tests FOR UPDATE
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- Policy: Admins can delete tests
CREATE POLICY "suite_tests_delete_admin"
  ON suite_tests FOR DELETE
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
  );

-- =====================================================
-- 8. Backfill org_suites from existing data
-- =====================================================

INSERT INTO org_suites (
  organization_id,
  name,
  tech_stack,
  test_count,
  last_execution_at,
  first_seen_at,
  updated_at
)
SELECT DISTINCT ON (te.organization_id, te.suite)
  te.organization_id,
  te.suite,
  'playwright',  -- Default, can be updated manually or via API
  0,  -- Will be updated by suite_tests backfill
  MAX(te.started_at) OVER (PARTITION BY te.organization_id, te.suite),
  MIN(te.started_at) OVER (PARTITION BY te.organization_id, te.suite),
  NOW()
FROM test_executions te
WHERE te.suite IS NOT NULL
  AND te.organization_id IS NOT NULL
ON CONFLICT (organization_id, name) DO NOTHING;

-- =====================================================
-- 9. Link existing executions to org_suites
-- =====================================================

UPDATE test_executions te
SET suite_id = os.id
FROM org_suites os
WHERE te.suite = os.name
  AND te.organization_id = os.organization_id
  AND te.suite_id IS NULL;

-- =====================================================
-- 10. Backfill suite_tests from existing data
-- =====================================================

INSERT INTO suite_tests (
  organization_id,
  suite_id,
  test_signature,
  test_name,
  test_file,
  is_critical,
  run_count,
  pass_count,
  fail_count,
  skip_count,
  last_status,
  last_duration_ms,
  avg_duration_ms,
  first_seen_at,
  last_seen_at,
  updated_at
)
SELECT
  te.organization_id,
  os.id as suite_id,
  COALESCE(tr.test_signature, MD5(tr.test_file || '::' || tr.test_name)) as test_signature,
  MAX(tr.test_name) as test_name,
  MAX(tr.test_file) as test_file,
  BOOL_OR(tr.is_critical) as is_critical,
  COUNT(*) as run_count,
  COUNT(*) FILTER (WHERE tr.status = 'passed') as pass_count,
  COUNT(*) FILTER (WHERE tr.status = 'failed') as fail_count,
  COUNT(*) FILTER (WHERE tr.status IN ('skipped', 'timedout')) as skip_count,
  (
    SELECT tr2.status
    FROM test_results tr2
    JOIN test_executions te2 ON tr2.execution_id = te2.id
    WHERE COALESCE(tr2.test_signature, MD5(tr2.test_file || '::' || tr2.test_name)) =
          COALESCE(tr.test_signature, MD5(tr.test_file || '::' || tr.test_name))
      AND te2.organization_id = te.organization_id
    ORDER BY tr2.started_at DESC NULLS LAST
    LIMIT 1
  ) as last_status,
  (
    SELECT tr2.duration_ms
    FROM test_results tr2
    JOIN test_executions te2 ON tr2.execution_id = te2.id
    WHERE COALESCE(tr2.test_signature, MD5(tr2.test_file || '::' || tr2.test_name)) =
          COALESCE(tr.test_signature, MD5(tr.test_file || '::' || tr.test_name))
      AND te2.organization_id = te.organization_id
    ORDER BY tr2.started_at DESC NULLS LAST
    LIMIT 1
  ) as last_duration_ms,
  COALESCE(ROUND(AVG(tr.duration_ms)), 0) as avg_duration_ms,
  MIN(tr.started_at) as first_seen_at,
  MAX(tr.started_at) as last_seen_at,
  NOW() as updated_at
FROM test_results tr
JOIN test_executions te ON tr.execution_id = te.id
LEFT JOIN org_suites os ON os.organization_id = te.organization_id
  AND os.name = te.suite
WHERE te.organization_id IS NOT NULL
GROUP BY
  te.organization_id,
  os.id,
  COALESCE(tr.test_signature, MD5(tr.test_file || '::' || tr.test_name))
ON CONFLICT (organization_id, test_signature) DO UPDATE SET
  suite_id = EXCLUDED.suite_id,
  run_count = EXCLUDED.run_count,
  pass_count = EXCLUDED.pass_count,
  fail_count = EXCLUDED.fail_count,
  skip_count = EXCLUDED.skip_count,
  last_status = EXCLUDED.last_status,
  last_duration_ms = EXCLUDED.last_duration_ms,
  avg_duration_ms = EXCLUDED.avg_duration_ms,
  last_seen_at = EXCLUDED.last_seen_at,
  is_critical = EXCLUDED.is_critical,
  updated_at = NOW();

-- =====================================================
-- 11. Update suite test counts
-- =====================================================

UPDATE org_suites os
SET
  test_count = (
    SELECT COUNT(*)
    FROM suite_tests st
    WHERE st.suite_id = os.id
      AND st.is_active = true
  ),
  updated_at = NOW();

-- =====================================================
-- 12. Set inactive flag for tests not seen in 30 days
-- =====================================================

UPDATE suite_tests
SET is_active = false, updated_at = NOW()
WHERE last_seen_at < NOW() - INTERVAL '30 days';

-- =====================================================
-- 13. Update last_execution_id for org_suites
-- =====================================================

UPDATE org_suites os
SET last_execution_id = (
  SELECT te.id
  FROM test_executions te
  WHERE te.suite_id = os.id
  ORDER BY te.started_at DESC
  LIMIT 1
);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- 1. Check tables were created:
-- SELECT * FROM information_schema.tables
-- WHERE table_name IN ('org_suites', 'suite_tests');

-- 2. Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE tablename IN ('org_suites', 'suite_tests');

-- 3. List policies:
-- SELECT schemaname, tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN ('org_suites', 'suite_tests');

-- 4. Check backfilled data:
-- SELECT COUNT(*) as suite_count FROM org_suites;
-- SELECT COUNT(*) as test_count FROM suite_tests;
-- SELECT COUNT(*) FILTER (WHERE is_active = false) as inactive_tests FROM suite_tests;

-- 5. Check suite assignments:
-- SELECT os.name, COUNT(st.id) as test_count
-- FROM org_suites os
-- LEFT JOIN suite_tests st ON st.suite_id = os.id
-- GROUP BY os.id, os.name;
