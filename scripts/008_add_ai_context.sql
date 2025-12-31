-- Migration 008: Add ai_context JSONB column for AI-friendly failure analysis
-- This column stores structured failure context optimized for Claude Code consumption
-- Only populated for failed/timedout tests
--
-- Schema:
-- {
--   "test_id": "string",           // Format: {file}::{test_name}
--   "timestamp": "ISO-8601",       // When failure occurred
--   "file": "string",              // Relative path to test file
--   "suite": ["string"],           // Describe block hierarchy
--   "test": "string",              // Test title
--   "error": {
--     "message": "string",         // Error message
--     "type": "string",            // TimeoutError, AssertionError, etc.
--     "location": "string"         // file:line:column from stack
--   },
--   "steps": ["string"],           // Last N test steps (from Playwright)
--   "last_step": "string",         // Step where it failed
--   "duration_ms": number,         // Test duration
--   "retries": number,             // Retry count
--   "last_api": {                  // Last API call (if available)
--     "method": "string",
--     "url": "string",
--     "status": number
--   },
--   "page_url": "string",          // URL at failure time
--   "browser": "string"            // Browser name
-- }

DO $$
BEGIN
    -- Add ai_context column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'test_results'
        AND column_name = 'ai_context'
    ) THEN
        ALTER TABLE test_results
        ADD COLUMN ai_context JSONB DEFAULT NULL;

        RAISE NOTICE 'Added ai_context column to test_results table';
    ELSE
        RAISE NOTICE 'ai_context column already exists';
    END IF;

    -- Create GIN index for JSONB queries (only on failed tests for efficiency)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_test_results_ai_context'
    ) THEN
        CREATE INDEX idx_test_results_ai_context
        ON test_results USING GIN (ai_context)
        WHERE ai_context IS NOT NULL
        AND status IN ('failed', 'timedout');

        RAISE NOTICE 'Created GIN index on ai_context column';
    ELSE
        RAISE NOTICE 'ai_context index already exists';
    END IF;

    -- Create index for error type queries (fixed: use -> then ->>)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_test_results_ai_context_error_type'
    ) THEN
        CREATE INDEX idx_test_results_ai_context_error_type
        ON test_results ((ai_context->'error'->>'type'))
        WHERE ai_context IS NOT NULL;

        RAISE NOTICE 'Created error type index';
    ELSE
        RAISE NOTICE 'Error type index already exists';
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN test_results.ai_context IS
'Structured failure context for AI troubleshooting. Contains error details, test steps,
page state, and API info. Only populated for failed/timedout tests.';
