-- Migration: Add full-text search support for hybrid search
-- Source: docs/prompts/research/advanced-accuracy-improvements.md
-- Expected improvement: 21% accuracy gain with hybrid search (Dense + BM25 via RRF)

-- Add tsvector column for full-text search on test_results
ALTER TABLE test_results
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector('english',
    coalesce(error_message, '') || ' ' ||
    coalesce(stack_trace, '') || ' ' ||
    coalesce(test_name, '') || ' ' ||
    coalesce(test_file, '')
  )
) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_test_results_search_vector
ON test_results USING GIN(search_vector);

-- Add comment
COMMENT ON COLUMN test_results.search_vector IS
'Full-text search vector for hybrid search (BM25). Combines error_message, stack_trace, test_name, and test_file for keyword matching.';
