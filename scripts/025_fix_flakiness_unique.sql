-- Fix: Replace single-column UNIQUE(test_signature) with multi-tenant UNIQUE(organization_id, test_signature)
-- Without this, one org's flakiness data overwrites another org's when they have tests with the same signature.

-- Drop the old constraint
ALTER TABLE test_flakiness_history DROP CONSTRAINT IF EXISTS test_flakiness_history_test_signature_key;

-- Add the correct multi-tenant unique constraint
ALTER TABLE test_flakiness_history ADD CONSTRAINT uq_flakiness_org_signature UNIQUE (organization_id, test_signature);
