-- Migration: Add Global Error Pattern Classification System
-- This creates tables for tracking recurring error patterns across all executions

-- 1. Global Error Patterns (cross-execution)
CREATE TABLE IF NOT EXISTS error_patterns (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  canonical_error TEXT NOT NULL,              -- Representative error message
  centroid_embedding vector(512),             -- Jina v2 embedding for matching
  category TEXT DEFAULT 'other',              -- Auto-inferred: timeout, auth, network, assertion, element, other
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_occurrences INTEGER DEFAULT 1,        -- Total failure count
  affected_executions INTEGER DEFAULT 1,      -- Unique executions count
  affected_tests INTEGER DEFAULT 1,           -- Unique test specs count
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Pattern-to-Failure Links
CREATE TABLE IF NOT EXISTS error_pattern_occurrences (
  id SERIAL PRIMARY KEY,
  pattern_id INTEGER NOT NULL REFERENCES error_patterns(id) ON DELETE CASCADE,
  test_result_id INTEGER NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
  execution_id INTEGER NOT NULL REFERENCES test_executions(id) ON DELETE CASCADE,
  distance_to_centroid FLOAT,                 -- Similarity score (cosine distance)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(test_result_id)
);

-- 3. Test Failure Tracking (separate from error patterns)
CREATE TABLE IF NOT EXISTS test_failure_stats (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  test_signature TEXT NOT NULL,               -- Normalized test identifier (file:title)
  test_file TEXT NOT NULL,
  test_title TEXT NOT NULL,
  total_failures INTEGER DEFAULT 1,
  total_runs INTEGER DEFAULT 1,               -- Total times this test ran
  failure_rate FLOAT GENERATED ALWAYS AS (
    CASE WHEN total_runs > 0 THEN total_failures::float / total_runs ELSE 0 END
  ) STORED,
  first_failure TIMESTAMP WITH TIME ZONE,
  last_failure TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, test_signature)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_error_patterns_org ON error_patterns(organization_id);
CREATE INDEX IF NOT EXISTS idx_error_patterns_category ON error_patterns(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_error_patterns_occurrences ON error_patterns(total_occurrences DESC);
CREATE INDEX IF NOT EXISTS idx_error_patterns_last_seen ON error_patterns(last_seen DESC);

CREATE INDEX IF NOT EXISTS idx_pattern_occurrences_pattern ON error_pattern_occurrences(pattern_id);
CREATE INDEX IF NOT EXISTS idx_pattern_occurrences_execution ON error_pattern_occurrences(execution_id);
CREATE INDEX IF NOT EXISTS idx_pattern_occurrences_created ON error_pattern_occurrences(created_at);

CREATE INDEX IF NOT EXISTS idx_test_failure_stats_org ON test_failure_stats(organization_id);
CREATE INDEX IF NOT EXISTS idx_test_failure_stats_rate ON test_failure_stats(organization_id, failure_rate DESC);
CREATE INDEX IF NOT EXISTS idx_test_failure_stats_failures ON test_failure_stats(organization_id, total_failures DESC);

-- Vector index for pattern matching (HNSW for fast similarity search)
CREATE INDEX IF NOT EXISTS idx_error_patterns_embedding ON error_patterns
  USING hnsw (centroid_embedding vector_cosine_ops);

-- Add comments for documentation
COMMENT ON TABLE error_patterns IS 'Global error patterns that persist across test executions';
COMMENT ON TABLE error_pattern_occurrences IS 'Links individual test failures to global error patterns';
COMMENT ON TABLE test_failure_stats IS 'Aggregated failure statistics per test spec';

COMMENT ON COLUMN error_patterns.canonical_error IS 'Representative error message for this pattern';
COMMENT ON COLUMN error_patterns.centroid_embedding IS 'Vector embedding (512-dim Jina v2) for similarity matching';
COMMENT ON COLUMN error_patterns.category IS 'Auto-inferred category: timeout, auth, network, assertion, element, other';
COMMENT ON COLUMN error_patterns.total_occurrences IS 'Total number of failures matching this pattern';
COMMENT ON COLUMN error_patterns.affected_executions IS 'Number of unique executions with this pattern';
COMMENT ON COLUMN error_patterns.affected_tests IS 'Number of unique test specs affected by this pattern';

COMMENT ON COLUMN error_pattern_occurrences.distance_to_centroid IS 'Cosine distance to pattern centroid (lower = more similar)';

COMMENT ON COLUMN test_failure_stats.test_signature IS 'Unique identifier: test_file:test_title';
COMMENT ON COLUMN test_failure_stats.failure_rate IS 'Computed as total_failures / total_runs';
