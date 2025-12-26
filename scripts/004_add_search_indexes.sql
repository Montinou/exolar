-- Migration 004: Add search indexes for test results
--
-- This migration adds trigram-based indexes to enable fuzzy text search
-- on test_name and test_file columns.
--
-- Prerequisites: pg_trgm extension must be enabled

-- Enable trigram extension for fuzzy search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram index on test_name for fuzzy search
CREATE INDEX IF NOT EXISTS idx_test_results_name_trgm
ON test_results USING gin (test_name gin_trgm_ops);

-- Create trigram index on test_file for fuzzy search
CREATE INDEX IF NOT EXISTS idx_test_results_file_trgm
ON test_results USING gin (test_file gin_trgm_ops);

-- Create composite index for status + signature queries (for history)
CREATE INDEX IF NOT EXISTS idx_test_results_signature_status
ON test_results(test_signature, status);

-- Create index for date-based queries with signature
CREATE INDEX IF NOT EXISTS idx_test_results_signature_started_at
ON test_results(test_signature, started_at DESC);
