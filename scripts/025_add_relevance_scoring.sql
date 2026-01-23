-- 025_add_relevance_scoring.sql
-- Test Relevance Scoring System
-- Hybrid auto-inferred + manual override scoring for test prioritization

-- ============================================
-- Test Relevance Scores Table
-- ============================================

CREATE TABLE IF NOT EXISTS test_relevance_scores (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  test_signature TEXT NOT NULL,
  test_name TEXT NOT NULL,
  test_file TEXT NOT NULL,

  -- Auto-inferred factors (0-100 each)
  failure_frequency_score INTEGER DEFAULT 50 CHECK (failure_frequency_score BETWEEN 0 AND 100),
  failure_recency_score INTEGER DEFAULT 50 CHECK (failure_recency_score BETWEEN 0 AND 100),
  path_criticality_score INTEGER DEFAULT 50 CHECK (path_criticality_score BETWEEN 0 AND 100),
  deployment_blocking_score INTEGER DEFAULT 50 CHECK (deployment_blocking_score BETWEEN 0 AND 100),

  -- Computed auto score (weighted average)
  -- Formula: (failure_frequency * 30%) + (recency * 25%) + (path_criticality * 30%) + (deployment_blocking * 15%)
  auto_relevance_score INTEGER GENERATED ALWAYS AS (
    ROUND(
      (failure_frequency_score * 0.30 +
       failure_recency_score * 0.25 +
       path_criticality_score * 0.30 +
       deployment_blocking_score * 0.15)
    )::INTEGER
  ) STORED,

  -- Manual override fields
  manual_relevance_label TEXT CHECK (manual_relevance_label IN ('critical', 'high', 'medium', 'low', 'ignore')),
  manual_override_score INTEGER CHECK (manual_override_score BETWEEN 0 AND 100),
  override_reason TEXT,
  overridden_by INTEGER REFERENCES dashboard_users(id),
  overridden_at TIMESTAMP WITH TIME ZONE,

  -- Final score (uses manual if set, otherwise auto)
  relevance_score INTEGER GENERATED ALWAYS AS (
    COALESCE(manual_override_score,
      ROUND(
        (failure_frequency_score * 0.30 +
         failure_recency_score * 0.25 +
         path_criticality_score * 0.30 +
         deployment_blocking_score * 0.15)
      )::INTEGER
    )
  ) STORED,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure uniqueness per org + test
  UNIQUE(organization_id, test_signature)
);

-- ============================================
-- Indexes for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_relevance_scores_org_id
  ON test_relevance_scores(organization_id);

CREATE INDEX IF NOT EXISTS idx_relevance_scores_final_score
  ON test_relevance_scores(organization_id, relevance_score DESC);

CREATE INDEX IF NOT EXISTS idx_relevance_scores_manual_label
  ON test_relevance_scores(organization_id, manual_relevance_label)
  WHERE manual_relevance_label IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_relevance_scores_needs_labeling
  ON test_relevance_scores(organization_id, auto_relevance_score DESC)
  WHERE manual_relevance_label IS NULL;

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE test_relevance_scores ENABLE ROW LEVEL SECURITY;

-- Allow users to read relevance scores for their org
CREATE POLICY "Users can view org relevance scores" ON test_relevance_scores
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = current_setting('app.current_user_id', true)::integer
    )
    OR current_setting('app.is_service_account', true)::boolean = true
  );

-- Allow service accounts and org admins to modify
CREATE POLICY "Service accounts and admins can modify" ON test_relevance_scores
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

-- ============================================
-- Path Criticality Patterns Table
-- ============================================

CREATE TABLE IF NOT EXISTS path_criticality_patterns (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, pattern)
);

-- Insert default patterns (NULL organization_id = global defaults)
INSERT INTO path_criticality_patterns (organization_id, pattern, score, description, is_default)
VALUES
  (NULL, 'payment', 90, 'Payment processing flows', true),
  (NULL, 'checkout', 90, 'Checkout/purchase flows', true),
  (NULL, 'auth', 85, 'Authentication flows', true),
  (NULL, 'login', 85, 'Login functionality', true),
  (NULL, 'signup', 80, 'User registration', true),
  (NULL, 'register', 80, 'User registration', true),
  (NULL, 'billing', 85, 'Billing operations', true),
  (NULL, 'transaction', 85, 'Financial transactions', true),
  (NULL, 'order', 80, 'Order management', true),
  (NULL, 'cart', 75, 'Shopping cart', true),
  (NULL, 'subscription', 80, 'Subscription management', true),
  (NULL, 'security', 85, 'Security-related tests', true),
  (NULL, 'admin', 70, 'Admin functionality', true),
  (NULL, 'settings', 60, 'User settings', true),
  (NULL, 'profile', 50, 'User profile', true),
  (NULL, 'dashboard', 65, 'Dashboard views', true),
  (NULL, 'api', 70, 'API endpoints', true),
  (NULL, 'integration', 75, 'Third-party integrations', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- Function to Update Relevance Scores
-- ============================================

CREATE OR REPLACE FUNCTION update_relevance_scores_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_relevance_scores_updated_at
  BEFORE UPDATE ON test_relevance_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_relevance_scores_timestamp();

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE test_relevance_scores IS 'Stores computed and manual relevance scores for tests to prioritize failures';
COMMENT ON COLUMN test_relevance_scores.failure_frequency_score IS 'Score based on how often the test fails (percentile rank)';
COMMENT ON COLUMN test_relevance_scores.failure_recency_score IS 'Score based on recency of failures (exponential decay: 100 × e^(-days/30))';
COMMENT ON COLUMN test_relevance_scores.path_criticality_score IS 'Score based on test path matching critical patterns (payment, auth, etc.)';
COMMENT ON COLUMN test_relevance_scores.deployment_blocking_score IS 'Score based on historical CI blocking rate';
COMMENT ON COLUMN test_relevance_scores.manual_relevance_label IS 'Human-assigned label: critical, high, medium, low, ignore';
COMMENT ON COLUMN test_relevance_scores.relevance_score IS 'Final score (0-100): uses manual_override_score if set, otherwise auto_relevance_score';
