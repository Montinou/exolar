-- Migration 017: Add Universal Test Embeddings
-- Purpose: Embed ALL tests (not just failures) and suite-level information
-- Date: 2026-01-12
--
-- This migration adds:
-- 1. test_embedding column to test_results for ALL tests (passed, failed, skipped)
-- 2. suite_embedding column to test_executions for suite-level context
-- 3. HNSW indexes for efficient vector search

-- ============================================
-- STEP 1: Add test_embedding column to test_results
-- ============================================
-- New column for ALL tests (passed, failed, skipped)
-- Stores the test context embedding (not error-specific)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_results'
    AND column_name = 'test_embedding'
  ) THEN
    ALTER TABLE test_results
    ADD COLUMN test_embedding vector(512);

    RAISE NOTICE 'Added test_embedding column to test_results';
  ELSE
    RAISE NOTICE 'test_embedding column already exists';
  END IF;

  -- Add hash for incremental re-indexing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_results'
    AND column_name = 'test_embedding_hash'
  ) THEN
    ALTER TABLE test_results
    ADD COLUMN test_embedding_hash TEXT;

    RAISE NOTICE 'Added test_embedding_hash column to test_results';
  ELSE
    RAISE NOTICE 'test_embedding_hash column already exists';
  END IF;
END $$;

COMMENT ON COLUMN test_results.test_embedding IS
  'Universal test embedding (512-dim Jina v3) for ALL tests. Embeds test name, file, status context.';

COMMENT ON COLUMN test_results.test_embedding_hash IS
  'Hash of text used for test_embedding. Used for incremental re-indexing.';

-- ============================================
-- STEP 2: Add suite_embedding column to test_executions
-- ============================================
-- Stores semantic embedding of suite-level information

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_executions'
    AND column_name = 'suite_embedding'
  ) THEN
    ALTER TABLE test_executions
    ADD COLUMN suite_embedding vector(512);

    RAISE NOTICE 'Added suite_embedding column to test_executions';
  ELSE
    RAISE NOTICE 'suite_embedding column already exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_executions'
    AND column_name = 'suite_embedding_hash'
  ) THEN
    ALTER TABLE test_executions
    ADD COLUMN suite_embedding_hash TEXT;

    RAISE NOTICE 'Added suite_embedding_hash column to test_executions';
  ELSE
    RAISE NOTICE 'suite_embedding_hash column already exists';
  END IF;
END $$;

COMMENT ON COLUMN test_executions.suite_embedding IS
  'Suite-level embedding (512-dim Jina v3). Embeds branch, suite name, commit message, test summary.';

COMMENT ON COLUMN test_executions.suite_embedding_hash IS
  'Hash of text used for suite_embedding. Used for incremental re-indexing.';

-- ============================================
-- STEP 3: Create indexes for new embedding columns
-- ============================================

-- HNSW index for test_embedding (ALL tests)
CREATE INDEX IF NOT EXISTS idx_test_results_test_embedding_hnsw
ON test_results
USING hnsw (test_embedding vector_cosine_ops)
WHERE test_embedding IS NOT NULL;

-- Partial index for execution filtering with test_embedding
CREATE INDEX IF NOT EXISTS idx_test_results_execution_test_embedding
ON test_results (execution_id)
WHERE test_embedding IS NOT NULL;

-- HNSW index for suite_embedding
CREATE INDEX IF NOT EXISTS idx_test_executions_suite_embedding_hnsw
ON test_executions
USING hnsw (suite_embedding vector_cosine_ops)
WHERE suite_embedding IS NOT NULL;

-- ============================================
-- STEP 4: Helper functions for new embeddings
-- ============================================

-- Function: Search tests by semantic similarity (ALL statuses)
CREATE OR REPLACE FUNCTION search_tests_semantic(
  p_organization_id INTEGER,
  p_embedding vector(512),
  p_threshold FLOAT DEFAULT 0.3,
  p_limit INTEGER DEFAULT 20,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id INTEGER,
  test_name TEXT,
  test_file TEXT,
  status TEXT,
  similarity FLOAT,
  execution_id INTEGER
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    tr.id,
    tr.test_name,
    tr.test_file,
    tr.status,
    1 - (tr.test_embedding <=> p_embedding) as similarity,
    tr.execution_id
  FROM test_results tr
  INNER JOIN test_executions te ON tr.execution_id = te.id
  WHERE te.organization_id = p_organization_id
    AND tr.test_embedding IS NOT NULL
    AND tr.test_embedding <=> p_embedding < p_threshold
    AND (p_status IS NULL OR tr.status = p_status)
  ORDER BY tr.test_embedding <=> p_embedding
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION search_tests_semantic IS
  'Search ALL tests (any status) by semantic similarity using universal test embeddings.';

-- Function: Search suites by semantic similarity
CREATE OR REPLACE FUNCTION search_suites_semantic(
  p_organization_id INTEGER,
  p_embedding vector(512),
  p_threshold FLOAT DEFAULT 0.3,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id INTEGER,
  branch TEXT,
  suite TEXT,
  commit_message TEXT,
  similarity FLOAT,
  started_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    te.id,
    te.branch,
    te.suite,
    te.commit_message,
    1 - (te.suite_embedding <=> p_embedding) as similarity,
    te.started_at
  FROM test_executions te
  WHERE te.organization_id = p_organization_id
    AND te.suite_embedding IS NOT NULL
    AND te.suite_embedding <=> p_embedding < p_threshold
  ORDER BY te.suite_embedding <=> p_embedding
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION search_suites_semantic IS
  'Search suite/execution summaries by semantic similarity.';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 017 completed: Universal test embeddings and suite embeddings added';
END $$;
