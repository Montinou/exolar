-- Migration 028: Add Clerk external IDs for auth migration
-- Neon Auth -> Clerk migration: add lookup columns for Clerk user/org IDs

ALTER TABLE dashboard_users ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS clerk_org_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_dashboard_users_clerk_id ON dashboard_users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_clerk_org_id ON organizations(clerk_org_id);
