-- 026_add_root_cause_clustering.sql
-- Hierarchical Root Cause Clustering for Failure Analysis
-- Replaces greedy clustering with category-based root cause identification

-- ============================================
-- Failure Root Causes Table
-- ============================================

CREATE TABLE IF NOT EXISTS failure_root_causes (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Canonical identifier (hash of category:subcategory:pattern)
  canonical_signature TEXT NOT NULL,

  -- Hierarchical classification
  error_category TEXT NOT NULL CHECK (error_category IN (
    'timeout',      -- TimeoutError, waiting for timed out
    'assertion',    -- expect().toBe, toEqual, toHaveText
    'network',      -- NetworkError, fetch failed, HTTP 4xx/5xx
    'element',      -- Locator not found, element not visible
    'api',          -- API response errors
    'other'         -- Uncategorized
  )),
  error_subcategory TEXT,         -- toBeTruthy, 401, locator.click, etc.
  pattern_signature TEXT,         -- Anonymized error pattern (variables replaced)

  -- Representative error for display
  representative_error TEXT NOT NULL,
  representative_stack_trace TEXT,

  -- Statistics
  total_occurrences INTEGER DEFAULT 1,
  affected_tests INTEGER DEFAULT 1,
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- AI-generated analysis
  ai_root_cause TEXT,             -- AI explanation of the root cause
  ai_fix_suggestion TEXT,         -- AI suggested fix
  ai_analyzed_at TIMESTAMP WITH TIME ZONE,

  -- Status tracking
  status TEXT DEFAULT 'open' CHECK (status IN (
    'open',           -- New/active root cause
    'investigating',  -- Being investigated
    'fixed',          -- Root cause resolved
    'wont_fix',       -- Acknowledged but not fixing
    'flaky'           -- Identified as flaky/intermittent
  )),
  status_changed_by INTEGER REFERENCES dashboard_users(id),
  status_changed_at TIMESTAMP WITH TIME ZONE,
  status_note TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(organization_id, canonical_signature)
);

-- ============================================
-- Link Table: Root Cause <-> Test Results
-- ============================================

CREATE TABLE IF NOT EXISTS failure_root_cause_links (
  id SERIAL PRIMARY KEY,
  root_cause_id INTEGER NOT NULL REFERENCES failure_root_causes(id) ON DELETE CASCADE,
  test_result_id INTEGER NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
  similarity_score REAL,          -- Similarity to representative (0-1)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(test_result_id)          -- Each test result belongs to at most one root cause
);

-- ============================================
-- Indexes for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_root_causes_org_id
  ON failure_root_causes(organization_id);

CREATE INDEX IF NOT EXISTS idx_root_causes_category
  ON failure_root_causes(organization_id, error_category);

CREATE INDEX IF NOT EXISTS idx_root_causes_status
  ON failure_root_causes(organization_id, status)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_root_causes_last_seen
  ON failure_root_causes(organization_id, last_seen DESC);

CREATE INDEX IF NOT EXISTS idx_root_cause_links_root_cause
  ON failure_root_cause_links(root_cause_id);

CREATE INDEX IF NOT EXISTS idx_root_cause_links_test_result
  ON failure_root_cause_links(test_result_id);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE failure_root_causes ENABLE ROW LEVEL SECURITY;
ALTER TABLE failure_root_cause_links ENABLE ROW LEVEL SECURITY;

-- Root causes visible to org members
CREATE POLICY "Users can view org root causes" ON failure_root_causes
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = current_setting('app.current_user_id', true)::integer
    )
    OR current_setting('app.is_service_account', true)::boolean = true
  );

-- Service accounts and admins can modify
CREATE POLICY "Service accounts and admins can modify root causes" ON failure_root_causes
  FOR ALL
  USING (
    current_setting('app.is_service_account', true)::boolean = true
    OR (
      organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = current_setting('app.current_user_id', true)::integer
        AND role IN ('owner', 'admin')
      )
    )
  );

-- Links inherit visibility from root causes
CREATE POLICY "Users can view root cause links" ON failure_root_cause_links
  FOR SELECT
  USING (
    root_cause_id IN (
      SELECT id FROM failure_root_causes
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = current_setting('app.current_user_id', true)::integer
      )
    )
    OR current_setting('app.is_service_account', true)::boolean = true
  );

CREATE POLICY "Service accounts can modify root cause links" ON failure_root_cause_links
  FOR ALL
  USING (
    current_setting('app.is_service_account', true)::boolean = true
  );

-- ============================================
-- Trigger for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_root_causes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_root_causes_updated_at
  BEFORE UPDATE ON failure_root_causes
  FOR EACH ROW
  EXECUTE FUNCTION update_root_causes_timestamp();

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE failure_root_causes IS 'Hierarchical root cause analysis for test failures';
COMMENT ON COLUMN failure_root_causes.canonical_signature IS 'Hash of category:subcategory:pattern for deduplication';
COMMENT ON COLUMN failure_root_causes.error_category IS 'Level 1: High-level error type (timeout, assertion, network, element, api, other)';
COMMENT ON COLUMN failure_root_causes.error_subcategory IS 'Level 2: Specific error subtype (e.g., toBeTruthy, 401, locator.click)';
COMMENT ON COLUMN failure_root_causes.pattern_signature IS 'Level 3: Anonymized pattern with variables replaced';
COMMENT ON COLUMN failure_root_causes.ai_root_cause IS 'AI-generated explanation of the underlying root cause';
COMMENT ON COLUMN failure_root_causes.ai_fix_suggestion IS 'AI-generated suggested fix or investigation steps';
COMMENT ON TABLE failure_root_cause_links IS 'Links individual test failures to their identified root causes';
