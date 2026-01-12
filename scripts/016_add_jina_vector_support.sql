-- Migration 016: Add Jina v3 Vector Support (512 dimensions)
-- Purpose: Additive migration for Jina embeddings alongside existing Gemini embeddings
-- Date: 2026-01-12
-- Author: Claude Code
--
-- This migration is NON-BREAKING: adds new columns without modifying existing ones.
-- Rollback: Simply drop the new columns if issues arise.

-- ============================================
-- STEP 1: Add v2 embedding column to test_results
-- ============================================
-- Using 512 dimensions for Jina v3 (Matryoshka representation)
-- Smaller vectors = faster search + less storage

DO $$
BEGIN
  -- Add error_embedding_v2 column (512-dim for Jina)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_results'
    AND column_name = 'error_embedding_v2'
  ) THEN
    ALTER TABLE test_results
    ADD COLUMN error_embedding_v2 vector(512);

    COMMENT ON COLUMN test_results.error_embedding_v2 IS
      'Vector embedding (512-dim) from Jina v3. Preferred over error_embedding (768-dim Gemini).';
  END IF;

  -- Add chunk hash for incremental indexing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_results'
    AND column_name = 'embedding_chunk_hash'
  ) THEN
    ALTER TABLE test_results
    ADD COLUMN embedding_chunk_hash TEXT;

    COMMENT ON COLUMN test_results.embedding_chunk_hash IS
      'Hash of the text used to generate embedding. Used for incremental re-indexing.';
  END IF;
END $$;

-- ============================================
-- STEP 2: Add v2 centroid column to failure_clusters
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'failure_clusters'
    AND column_name = 'centroid_embedding_v2'
  ) THEN
    ALTER TABLE failure_clusters
    ADD COLUMN centroid_embedding_v2 vector(512);

    COMMENT ON COLUMN failure_clusters.centroid_embedding_v2 IS
      'Cluster centroid using Jina v3 embeddings (512-dim).';
  END IF;
END $$;

-- ============================================
-- STEP 3: Create HNSW index for v2 embeddings
-- ============================================
-- Separate index for 512-dim vectors optimized for Jina

CREATE INDEX IF NOT EXISTS idx_test_results_embedding_v2_hnsw
ON test_results
USING hnsw (error_embedding_v2 vector_cosine_ops)
WHERE error_embedding_v2 IS NOT NULL;

-- Partial index for execution filtering with v2 embeddings
CREATE INDEX IF NOT EXISTS idx_test_results_execution_embedding_v2
ON test_results (execution_id)
WHERE error_embedding_v2 IS NOT NULL;

-- ============================================
-- STEP 4: Functions for v2 similarity search
-- ============================================

-- Function: Find similar failures within an execution (v2, 512-dim)
CREATE OR REPLACE FUNCTION find_similar_failures_v2(
  p_execution_id INTEGER,
  p_embedding vector(512),
  p_threshold FLOAT DEFAULT 0.1,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id INTEGER,
  test_name TEXT,
  error_message TEXT,
  similarity FLOAT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    tr.id,
    tr.test_name,
    tr.error_message,
    1 - (tr.error_embedding_v2 <=> p_embedding) as similarity
  FROM test_results tr
  WHERE tr.execution_id = p_execution_id
    AND tr.error_embedding_v2 IS NOT NULL
    AND tr.error_embedding_v2 <=> p_embedding < p_threshold
  ORDER BY tr.error_embedding_v2 <=> p_embedding
  LIMIT p_limit;
$$;

-- Function: Find similar failures across all executions (v2, 512-dim)
CREATE OR REPLACE FUNCTION find_similar_failures_global_v2(
  p_organization_id INTEGER,
  p_embedding vector(512),
  p_threshold FLOAT DEFAULT 0.15,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id INTEGER,
  execution_id INTEGER,
  test_name TEXT,
  error_message TEXT,
  similarity FLOAT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT
    tr.id,
    tr.execution_id,
    tr.test_name,
    tr.error_message,
    1 - (tr.error_embedding_v2 <=> p_embedding) as similarity,
    tr.created_at
  FROM test_results tr
  INNER JOIN test_executions te ON tr.execution_id = te.id
  WHERE te.organization_id = p_organization_id
    AND tr.error_embedding_v2 IS NOT NULL
    AND tr.error_embedding_v2 <=> p_embedding < p_threshold
  ORDER BY tr.error_embedding_v2 <=> p_embedding
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION find_similar_failures_v2 IS
  'Find failures with similar Jina v3 embeddings (512-dim) within a single execution.';

COMMENT ON FUNCTION find_similar_failures_global_v2 IS
  'Find failures with similar Jina v3 embeddings (512-dim) across all executions in org.';

-- ============================================
-- STEP 5: Hybrid function (uses v2 if available, falls back to v1)
-- ============================================

CREATE OR REPLACE FUNCTION find_similar_failures_hybrid(
  p_execution_id INTEGER,
  p_embedding_v2 vector(512) DEFAULT NULL,
  p_embedding_v1 vector(768) DEFAULT NULL,
  p_threshold FLOAT DEFAULT 0.1,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id INTEGER,
  test_name TEXT,
  error_message TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Try v2 first (Jina 512-dim)
  IF p_embedding_v2 IS NOT NULL THEN
    RETURN QUERY
    SELECT
      tr.id,
      tr.test_name,
      tr.error_message,
      1 - (tr.error_embedding_v2 <=> p_embedding_v2) as similarity
    FROM test_results tr
    WHERE tr.execution_id = p_execution_id
      AND tr.error_embedding_v2 IS NOT NULL
      AND tr.error_embedding_v2 <=> p_embedding_v2 < p_threshold
    ORDER BY tr.error_embedding_v2 <=> p_embedding_v2
    LIMIT p_limit;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- Fallback to v1 (Gemini 768-dim)
  IF p_embedding_v1 IS NOT NULL THEN
    RETURN QUERY
    SELECT
      tr.id,
      tr.test_name,
      tr.error_message,
      1 - (tr.error_embedding <=> p_embedding_v1) as similarity
    FROM test_results tr
    WHERE tr.execution_id = p_execution_id
      AND tr.error_embedding IS NOT NULL
      AND tr.error_embedding <=> p_embedding_v1 < p_threshold
    ORDER BY tr.error_embedding <=> p_embedding_v1
    LIMIT p_limit;
  END IF;

  RETURN;
END;
$$;

COMMENT ON FUNCTION find_similar_failures_hybrid IS
  'Find similar failures using v2 (512-dim) if available, falling back to v1 (768-dim).';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 016 completed: Jina v3 vector support (512-dim) added alongside Gemini (768-dim)';
END $$;

-- ============================================
-- ROLLBACK INSTRUCTIONS (run if needed)
-- ============================================
/*
-- Safe rollback: removes only v2 columns and functions
DROP FUNCTION IF EXISTS find_similar_failures_hybrid(INTEGER, vector(512), vector(768), FLOAT, INTEGER);
DROP FUNCTION IF EXISTS find_similar_failures_global_v2(INTEGER, vector(512), FLOAT, INTEGER);
DROP FUNCTION IF EXISTS find_similar_failures_v2(INTEGER, vector(512), FLOAT, INTEGER);
DROP INDEX IF EXISTS idx_test_results_execution_embedding_v2;
DROP INDEX IF EXISTS idx_test_results_embedding_v2_hnsw;
ALTER TABLE failure_clusters DROP COLUMN IF EXISTS centroid_embedding_v2;
ALTER TABLE test_results DROP COLUMN IF EXISTS embedding_chunk_hash;
ALTER TABLE test_results DROP COLUMN IF EXISTS error_embedding_v2;
*/
