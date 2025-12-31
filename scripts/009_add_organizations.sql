-- =====================================================
-- Migration 009: Add Organizations for Multi-Tenancy
-- =====================================================
-- Prerequisites: 007_create_user_tables.sql, 005_flaky_test_detection.sql
--
-- This migration transforms the dashboard from single-tenant to multi-tenant
-- with organization-level data isolation. Admin-only org management.

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,  -- URL-friendly identifier (e.g., "acme-corp")
  created_by INTEGER REFERENCES dashboard_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create organization_members junction table
CREATE TABLE IF NOT EXISTS organization_members (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer',  -- 'owner', 'admin', 'viewer'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- 3. Create Attorneyshare organization for existing data
INSERT INTO organizations (name, slug, created_at)
VALUES ('Attorneyshare', 'attorneyshare', NOW())
ON CONFLICT (slug) DO NOTHING;

-- 4. Add default_org_id to dashboard_users
ALTER TABLE dashboard_users
ADD COLUMN IF NOT EXISTS default_org_id INTEGER REFERENCES organizations(id);

-- 5. Add organization_id to test_executions
ALTER TABLE test_executions
ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);

-- 6. Add organization_id to test_flakiness_history
ALTER TABLE test_flakiness_history
ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);

-- 7. Assign all existing users to Attorneyshare org
UPDATE dashboard_users
SET default_org_id = (SELECT id FROM organizations WHERE slug = 'attorneyshare')
WHERE default_org_id IS NULL;

-- 8. Assign all existing test_executions to Attorneyshare org
UPDATE test_executions
SET organization_id = (SELECT id FROM organizations WHERE slug = 'attorneyshare')
WHERE organization_id IS NULL;

-- 9. Assign all existing test_flakiness_history to Attorneyshare org
UPDATE test_flakiness_history
SET organization_id = (SELECT id FROM organizations WHERE slug = 'attorneyshare')
WHERE organization_id IS NULL;

-- 10. Add existing users to Attorneyshare organization (agusmontoya@gmail.com as owner)
INSERT INTO organization_members (organization_id, user_id, role, joined_at)
SELECT
  (SELECT id FROM organizations WHERE slug = 'attorneyshare'),
  id,
  CASE WHEN role = 'admin' THEN 'owner' ELSE 'viewer' END,
  created_at
FROM dashboard_users
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 11. Add org_id to invites table for org-specific invitations
ALTER TABLE invites
ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id);

-- 12. Assign existing invites to Attorneyshare org
UPDATE invites
SET org_id = (SELECT id FROM organizations WHERE slug = 'attorneyshare')
WHERE org_id IS NULL;

-- 13. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_org_id ON test_executions(organization_id);
CREATE INDEX IF NOT EXISTS idx_test_flakiness_org_id ON test_flakiness_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_invites_org_id ON invites(org_id);

-- Note: Making organization_id NOT NULL should be done in a separate migration
-- after verifying all data has been migrated correctly:
-- ALTER TABLE test_executions ALTER COLUMN organization_id SET NOT NULL;
-- ALTER TABLE test_flakiness_history ALTER COLUMN organization_id SET NOT NULL;
