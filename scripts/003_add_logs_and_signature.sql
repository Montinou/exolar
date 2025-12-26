-- Migration 003: Add test_signature and logs columns to test_results
--
-- This migration adds two columns:
-- 1. test_signature: MD5 hash of test_file::test_name for deduplication and artifact matching
-- 2. logs: JSONB array for structured log entries captured during test execution
--
-- NOTE: This migration was applied during initial schema creation (2024-12-26).
-- The columns are already included in the CREATE TABLE statement in the inline setup.
-- This file is kept for documentation purposes.

-- Add test_signature column for test identification (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'test_results' AND column_name = 'test_signature'
    ) THEN
        ALTER TABLE test_results ADD COLUMN test_signature TEXT;
    END IF;
END $$;

-- Add logs column for structured test logs (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'test_results' AND column_name = 'logs'
    ) THEN
        ALTER TABLE test_results ADD COLUMN logs JSONB;
    END IF;
END $$;

-- Create index on test_signature for efficient lookups
CREATE INDEX IF NOT EXISTS idx_test_results_test_signature
ON test_results(test_signature);

-- Backfill existing records with generated signatures (file::name MD5)
UPDATE test_results
SET test_signature = md5(test_file || '::' || test_name)
WHERE test_signature IS NULL;
