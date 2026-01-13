-- Migration: Add query embedding cache
-- Source: docs/prompts/research/query-caching-strategies.md
-- Expected impact: 40-50% cache hit rate, reducing embedding API costs

-- Create query_embeddings cache table
CREATE TABLE IF NOT EXISTS query_embeddings (
  query_hash TEXT NOT NULL,
  organization_id INTEGER NOT NULL,
  query_normalized TEXT NOT NULL,
  embedding vector(512) NOT NULL,
  cache_hits INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  PRIMARY KEY (query_hash, organization_id)
);

-- Index for cache lookups
CREATE INDEX IF NOT EXISTS idx_query_embeddings_org
ON query_embeddings(organization_id);

-- Index for cache cleanup (find stale entries)
CREATE INDEX IF NOT EXISTS idx_query_embeddings_last_accessed
ON query_embeddings(last_accessed);

-- Add foreign key constraint (if organizations table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    ALTER TABLE query_embeddings
    ADD CONSTRAINT fk_query_embeddings_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE query_embeddings IS
'Semantic cache for query embeddings to reduce API costs. Stores 512-dim Jina v3 embeddings.';

COMMENT ON COLUMN query_embeddings.query_hash IS
'SHA-256 hash of normalized query for fast lookups';

COMMENT ON COLUMN query_embeddings.query_normalized IS
'Normalized query text (lowercase, trimmed, deduplicated spaces)';

COMMENT ON COLUMN query_embeddings.embedding IS
'Cached 512-dimensional Jina v3 embedding';

COMMENT ON COLUMN query_embeddings.cache_hits IS
'Number of times this cached entry was reused';

COMMENT ON COLUMN query_embeddings.last_accessed IS
'Last time this cache entry was used (for TTL cleanup)';
