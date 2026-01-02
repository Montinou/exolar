-- Organization API Keys for CI/CD Ingestion
-- Allows GitHub Actions to ingest test data associated with an organization

CREATE TABLE IF NOT EXISTS organization_api_keys (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash of the key
  key_prefix VARCHAR(16) NOT NULL,  -- First chars for display (e.g., "aestra_abc1...")
  created_by INTEGER REFERENCES dashboard_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,  -- NULL = never expires
  revoked_at TIMESTAMPTZ,  -- NULL = active
  UNIQUE(key_hash)
);

-- Index for fast lookups by organization
CREATE INDEX IF NOT EXISTS idx_org_api_keys_org ON organization_api_keys(organization_id);

-- Index for fast validation by hash
CREATE INDEX IF NOT EXISTS idx_org_api_keys_hash ON organization_api_keys(key_hash);

-- Index for filtering active keys
CREATE INDEX IF NOT EXISTS idx_org_api_keys_active ON organization_api_keys(organization_id)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE organization_api_keys IS 'API keys for CI/CD ingestion, scoped to organizations';
COMMENT ON COLUMN organization_api_keys.key_hash IS 'SHA-256 hash of the API key - never store plain keys';
COMMENT ON COLUMN organization_api_keys.key_prefix IS 'Display prefix for identification (e.g., aestra_abc1...)';
COMMENT ON COLUMN organization_api_keys.revoked_at IS 'Soft delete - set when key is revoked';
