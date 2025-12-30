-- Migration: Add suite column to test_executions
-- Purpose: Track which test suite each execution belongs to (e.g., Negotiation, Marketplace, Signin)

-- Add suite column to track which test suite the execution belongs to
ALTER TABLE test_executions ADD COLUMN IF NOT EXISTS suite TEXT;

-- Create index for efficient filtering by suite
CREATE INDEX IF NOT EXISTS idx_test_executions_suite ON test_executions(suite);

-- Add comment for documentation
COMMENT ON COLUMN test_executions.suite IS 'Test suite name (e.g., Negotiation, Marketplace, Signin, Waterfall Referrals)';
