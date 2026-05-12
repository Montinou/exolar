-- =====================================================
-- Migration 030: Backfill AttorneyShare org for all users + data
-- =====================================================
-- Context: after the Neon Auth → Clerk migration (028), the Clerk webhook
-- creates `dashboard_users` rows on user.created BUT does not set
-- `default_org_id` or insert into `organization_members`. Any user signed
-- up via Clerk lands in `getSessionContext() == null` → no-access page.
--
-- This migration:
--   1. Ensures the "AttorneyShare" org exists (idempotent — migration 009
--      already creates it with slug 'attorneyshare', but we re-assert).
--   2. Backfills `default_org_id` on every `dashboard_users` row missing it.
--   3. Inserts an `organization_members` row for every user, with role
--      derived from existing user fields:
--        - is_superadmin = true        → 'owner'
--        - role = 'admin'              → 'admin'
--        - otherwise                   → 'viewer'
--   4. Backfills `organization_id` on every data table that has the column
--      but a NULL value (post-migration leftovers).
--   5. Enforces NOT NULL on `default_org_id` going forward — every new
--      user must land in an org (the Clerk webhook is updated in this PR
--      to honor this).
--
-- Idempotent. Safe to run multiple times. Each step is a no-op if already
-- in the target state.
-- =====================================================

BEGIN;

-- 1. AttorneyShare org (idempotent — slug is the conflict key from 009)
INSERT INTO organizations (name, slug, created_at)
VALUES ('AttorneyShare', 'attorneyshare', NOW())
ON CONFLICT (slug) DO UPDATE SET name = 'AttorneyShare';

-- Capture the org id for downstream operations.
DO $$
DECLARE
  v_org_id INTEGER;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = 'attorneyshare';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'AttorneyShare org not found after upsert';
  END IF;

  -- 2. Backfill default_org_id on users missing it
  UPDATE dashboard_users
  SET default_org_id = v_org_id
  WHERE default_org_id IS NULL;

  -- 3. Insert organization_members for every user missing membership
  INSERT INTO organization_members (organization_id, user_id, role, joined_at)
  SELECT
    v_org_id,
    u.id,
    CASE
      WHEN u.is_superadmin IS TRUE THEN 'owner'
      WHEN u.role = 'admin'        THEN 'admin'
      ELSE 'viewer'
    END,
    u.created_at
  FROM dashboard_users u
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- 4. Backfill organization_id on every data table with a NULL value.
  --    Wrapped in EXECUTE so missing tables don't crash the migration
  --    (some columns came in via later migrations and may not be present
  --    in older environments).

  -- 4a. test_executions
  UPDATE test_executions SET organization_id = v_org_id WHERE organization_id IS NULL;

  -- 4b. test_flakiness_history
  UPDATE test_flakiness_history SET organization_id = v_org_id WHERE organization_id IS NULL;

  -- 4c. invites
  UPDATE invites SET org_id = v_org_id WHERE org_id IS NULL;

  -- 4d. performance_baselines (migration 013)
  PERFORM 1 FROM information_schema.tables WHERE table_name = 'performance_baselines';
  IF FOUND THEN
    EXECUTE 'UPDATE performance_baselines SET organization_id = $1 WHERE organization_id IS NULL' USING v_org_id;
  END IF;

  -- 4e. suite_test_tracking (migration 014)
  PERFORM 1 FROM information_schema.tables WHERE table_name = 'org_suites';
  IF FOUND THEN
    EXECUTE 'UPDATE org_suites SET organization_id = $1 WHERE organization_id IS NULL' USING v_org_id;
  END IF;

  -- 4f. ci_analysis (migration 016)
  PERFORM 1 FROM information_schema.tables WHERE table_name = 'ci_analysis_runs';
  IF FOUND THEN
    EXECUTE 'UPDATE ci_analysis_runs SET organization_id = $1 WHERE organization_id IS NULL' USING v_org_id;
  END IF;

  -- 4g. mock_interfaces + related (migration 020)
  PERFORM 1 FROM information_schema.tables WHERE table_name = 'mock_interfaces';
  IF FOUND THEN
    EXECUTE 'UPDATE mock_interfaces SET organization_id = $1 WHERE organization_id IS NULL' USING v_org_id;
  END IF;

  -- 4h. organization_api_keys (migration 012)
  PERFORM 1 FROM information_schema.tables WHERE table_name = 'organization_api_keys';
  IF FOUND THEN
    EXECUTE 'UPDATE organization_api_keys SET organization_id = $1 WHERE organization_id IS NULL' USING v_org_id;
  END IF;

  -- 4i. smart_selection_decisions (migration 029)
  PERFORM 1 FROM information_schema.tables WHERE table_name = 'smart_selection_decisions';
  IF FOUND THEN
    EXECUTE 'UPDATE smart_selection_decisions SET organization_id = $1 WHERE organization_id IS NULL' USING v_org_id;
  END IF;

  -- 4j. failure_clusters / failure_cluster_members (migration 015) —
  --     these have no direct org column (governed via execution_id), no
  --     backfill needed.

  RAISE NOTICE 'Backfill complete: org_id=% (slug=attorneyshare)', v_org_id;
END $$;

-- 5. Enforce NOT NULL going forward. With every existing row now populated,
--    this constraint catches any future user that somehow lands here
--    without an org (the Clerk webhook in this PR also assigns the org,
--    so this should never fire in practice).
ALTER TABLE dashboard_users ALTER COLUMN default_org_id SET NOT NULL;

COMMIT;

-- =====================================================
-- Manual verification queries (run after the migration):
--
--   -- All users have a default org
--   SELECT COUNT(*) FROM dashboard_users WHERE default_org_id IS NULL;
--   -- Expected: 0
--
--   -- Every user has at least one membership
--   SELECT u.email
--   FROM dashboard_users u
--   LEFT JOIN organization_members om ON om.user_id = u.id
--   WHERE om.id IS NULL;
--   -- Expected: 0 rows
--
--   -- No orphaned data
--   SELECT COUNT(*) FROM test_executions       WHERE organization_id IS NULL;
--   SELECT COUNT(*) FROM test_flakiness_history WHERE organization_id IS NULL;
--   -- Expected: 0
--
-- =====================================================
