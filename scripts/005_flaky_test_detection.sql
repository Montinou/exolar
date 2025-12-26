-- Migration 005: Flaky Test Detection
--
-- This migration adds the infrastructure for tracking flaky tests.
-- A test is considered flaky if:
-- 1. It passed after retry (retry_count > 0 AND status = 'passed')
-- 2. It has both pass and fail results within 7 days
--
-- Prerequisites: 003_add_logs_and_signature.sql (test_signature column)

-- Add flaky indicator to test_results
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS is_flaky BOOLEAN DEFAULT false;

-- Create index for flaky tests (partial index for efficiency)
CREATE INDEX IF NOT EXISTS idx_test_results_flaky
  ON test_results(is_flaky) WHERE is_flaky = true;

-- Create flakiness history tracking table
CREATE TABLE IF NOT EXISTS test_flakiness_history (
  id SERIAL PRIMARY KEY,
  test_signature TEXT NOT NULL UNIQUE,
  test_name TEXT NOT NULL,
  test_file TEXT NOT NULL,
  total_runs INTEGER DEFAULT 0,
  flaky_runs INTEGER DEFAULT 0,
  passed_runs INTEGER DEFAULT 0,
  failed_runs INTEGER DEFAULT 0,
  flakiness_rate DECIMAL(5,2) DEFAULT 0,
  avg_duration_ms INTEGER DEFAULT 0,
  last_flaky_at TIMESTAMP WITH TIME ZONE,
  last_passed_at TIMESTAMP WITH TIME ZONE,
  last_failed_at TIMESTAMP WITH TIME ZONE,
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_flakiness_rate
  ON test_flakiness_history(flakiness_rate DESC);
CREATE INDEX IF NOT EXISTS idx_flakiness_flaky_runs
  ON test_flakiness_history(flaky_runs DESC);
CREATE INDEX IF NOT EXISTS idx_flakiness_updated
  ON test_flakiness_history(updated_at DESC);

-- Backfill is_flaky for existing records
-- A test is flaky if it passed after at least one retry
UPDATE test_results
SET is_flaky = true
WHERE retry_count > 0 AND status = 'passed';

-- Backfill flakiness history from existing data
INSERT INTO test_flakiness_history (
  test_signature,
  test_name,
  test_file,
  total_runs,
  flaky_runs,
  passed_runs,
  failed_runs,
  flakiness_rate,
  avg_duration_ms,
  last_flaky_at,
  last_passed_at,
  last_failed_at,
  first_seen_at,
  updated_at
)
SELECT
  COALESCE(test_signature, MD5(test_file || '::' || test_name)) as test_signature,
  test_name,
  test_file,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE retry_count > 0 AND status = 'passed') as flaky_runs,
  COUNT(*) FILTER (WHERE status = 'passed') as passed_runs,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_runs,
  CASE
    WHEN COUNT(*) FILTER (WHERE status = 'passed') > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE retry_count > 0 AND status = 'passed')::decimal
      / COUNT(*) FILTER (WHERE status = 'passed') * 100, 2
    )
    ELSE 0
  END as flakiness_rate,
  ROUND(AVG(duration_ms)) as avg_duration_ms,
  MAX(started_at) FILTER (WHERE retry_count > 0 AND status = 'passed') as last_flaky_at,
  MAX(started_at) FILTER (WHERE status = 'passed') as last_passed_at,
  MAX(started_at) FILTER (WHERE status = 'failed') as last_failed_at,
  MIN(started_at) as first_seen_at,
  NOW() as updated_at
FROM test_results
GROUP BY test_name, test_file, test_signature
ON CONFLICT (test_signature) DO UPDATE SET
  total_runs = EXCLUDED.total_runs,
  flaky_runs = EXCLUDED.flaky_runs,
  passed_runs = EXCLUDED.passed_runs,
  failed_runs = EXCLUDED.failed_runs,
  flakiness_rate = EXCLUDED.flakiness_rate,
  avg_duration_ms = EXCLUDED.avg_duration_ms,
  last_flaky_at = EXCLUDED.last_flaky_at,
  last_passed_at = EXCLUDED.last_passed_at,
  last_failed_at = EXCLUDED.last_failed_at,
  updated_at = NOW();
