-- =====================================================
-- Migration 034: Join keys for smart-selection metrics (merge_commit_sha, branch)
-- =====================================================
--
-- PURPOSE:
--   ENG-1434 cross-repo review found that the metrics join in
--   getSuiteVerdictsForCommit() (lib/db/smart-selection.ts) can never match:
--   `test_executions.commit_sha` is populated from the PR's MERGE commit,
--   not the head sha that Eve was sending. Verified: PR#2003 merge sha
--   48250267 == execution 3434's commit_sha; the PR head sha 1f8844b is
--   never stored anywhere in test_executions.
--
--   Eve is being changed (in parallel) to also send `merge_commit_sha`
--   (nullable — unknown until GitHub merges the PR) and `branch` (the PR's
--   head ref) alongside the existing `head_sha`. This migration adds
--   matching nullable columns so Exolar can store and later join on them.
--
--   Does NOT touch the existing upsert key
--   (organization_id, repository, pr_number, head_sha, mode).
--
-- ROLLBACK:
--   ALTER TABLE smart_selection_decisions DROP COLUMN IF EXISTS merge_commit_sha;
--   ALTER TABLE smart_selection_decisions DROP COLUMN IF EXISTS branch;
--
-- =====================================================

ALTER TABLE smart_selection_decisions
  ADD COLUMN IF NOT EXISTS merge_commit_sha TEXT,
  ADD COLUMN IF NOT EXISTS branch TEXT;

COMMENT ON COLUMN smart_selection_decisions.merge_commit_sha IS
  'PR merge commit sha, when known. This is what test_executions.commit_sha actually stores (not head_sha) — primary join key for computing metrics via getSuiteVerdictsForCommit(). Nullable: unknown until GitHub merges the PR.';

COMMENT ON COLUMN smart_selection_decisions.branch IS
  'PR head ref (branch name). Fallback join key for metrics computation when neither merge_commit_sha nor head_sha matches any test_executions row for this org.';
