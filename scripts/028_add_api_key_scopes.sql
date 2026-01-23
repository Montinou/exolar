-- 028_add_api_key_scopes.sql
-- Add scope column to API keys for controlling write access

-- Add scope column (existing keys default to 'read')
ALTER TABLE organization_api_keys
  ADD COLUMN IF NOT EXISTS scope VARCHAR(20) DEFAULT 'read'
  CHECK (scope IN ('read', 'write', 'admin'));

-- Update comment
COMMENT ON COLUMN organization_api_keys.scope IS 'API key scope: read (default), write (allows mutations), admin (full access)';

-- Index for filtering by scope
CREATE INDEX IF NOT EXISTS idx_org_api_keys_scope
  ON organization_api_keys(organization_id, scope)
  WHERE revoked_at IS NULL;
