-- Fix H-3: Make organization_id NOT NULL on core tables
-- Fix H-7: Convert TIMESTAMP → TIMESTAMPTZ on user tables

-- H-3: Enforce NOT NULL organization_id
-- First set any existing NULLs to a default (org 1)
UPDATE test_executions SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE test_flakiness_history SET organization_id = 1 WHERE organization_id IS NULL;

ALTER TABLE test_executions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE test_flakiness_history ALTER COLUMN organization_id SET NOT NULL;

-- H-7: Fix timestamp columns on user tables to use TIMESTAMPTZ
ALTER TABLE dashboard_users ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE dashboard_users ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Check if invites table has same issue
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invites'
    AND column_name = 'created_at'
    AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE invites ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
  END IF;
END $$;

-- M-5: Add composite index for the most frequent dashboard query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_executions_org_completed
  ON test_executions (organization_id, completed_at DESC NULLS LAST)
  WHERE completed_at IS NOT NULL;
