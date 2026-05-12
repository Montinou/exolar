-- =====================================================
-- Migration 029: Smart Test Selection Decisions
-- =====================================================
--
-- PREREQUISITES:
--   1. Migration 009_add_organizations.sql (organizations table + RLS helpers)
--
-- PURPOSE:
--   Persist one row per smart-selection invocation (per PR per push) for
--   audit and calibration. Covers both shadow mode (LLM suggests, CI runs
--   everything) and active mode (LLM-driven skips). Also captures catalog
--   drift findings as informative signals.
--
--   Designed for the smart_selection client at:
--     attorney_share_mvp_web/automation/playwright/smart-selection/lib/exolar/log.ts
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS smart_selection_decisions CASCADE;
--
-- =====================================================

CREATE TABLE IF NOT EXISTS smart_selection_decisions (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- PR identity
  repository TEXT NOT NULL,                          -- "owner/repo"
  pr_number INTEGER NOT NULL,
  base_sha TEXT NOT NULL,
  head_sha TEXT NOT NULL,
  author TEXT NOT NULL,

  -- Smart-selection mode + model
  mode TEXT NOT NULL,                                -- shadow | active | active_overridden
  model TEXT NOT NULL,                               -- e.g. google/gemini-2.5-flash-lite
  system_prompt_hash TEXT NOT NULL,                  -- 12-char SHA256 of the cacheable system prompt

  -- Inputs the LLM saw
  input JSONB NOT NULL,
  -- {
  --   file_count: int,
  --   sanitized_token_count: int,
  --   dropped_paths_count: int,
  --   sanitizer_tier: 1 | 2 | 3
  -- }

  -- LLM output
  output JSONB NOT NULL,
  -- {
  --   selected_suites: string[],
  --   skipped_suites: string[],
  --   confidence: number (0..1),
  --   observation: string,
  --   uncertainty_flags: string[]
  -- }

  -- What actually ran (after the workflow respected or ignored the LLM)
  actual_run JSONB NOT NULL,
  -- {
  --   suites_run: string[],
  --   outcomes: { <suite>: 'passed' | 'failed' | 'timed_out' }
  -- }

  -- Confusion matrix vs actual outcomes
  metrics JSONB NOT NULL,
  -- { false_negatives, false_positives, true_positives, true_negatives }

  -- Latency + token usage from the gateway
  timing JSONB NOT NULL,
  -- { inference_latency_ms, input_tokens, output_tokens }

  -- Informative drift report (does NOT block CI)
  catalog_drift JSONB NOT NULL DEFAULT '{"structural": [], "coverage": []}'::jsonb,
  -- {
  --   structural: [{ kind: 'extra-test-dir' | 'unmapped-feature-dir', name }],
  --   coverage: [{ suiteName, oldHash, newHash }]
  -- }

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- One row per (org, repo, PR, head_sha) so re-runs of the same commit dedupe gracefully
  CONSTRAINT smart_selection_decisions_unique_per_push
    UNIQUE (organization_id, repository, pr_number, head_sha, mode)
);

-- =====================================================
-- Mode constraint
-- =====================================================
ALTER TABLE smart_selection_decisions
ADD CONSTRAINT smart_selection_decisions_mode_check
CHECK (mode IN ('shadow', 'active', 'active_overridden'));

COMMENT ON TABLE smart_selection_decisions IS
  'One row per smart-selection invocation (per PR per push). Audit + calibration data for the LLM-driven Playwright suite recommender.';

COMMENT ON COLUMN smart_selection_decisions.mode IS
  'shadow: LLM suggests but CI runs everything. active: LLM drives skips. active_overridden: PR title contained [run-all], so override.';

COMMENT ON COLUMN smart_selection_decisions.catalog_drift IS
  'Drift findings (structural + coverage). Informative — does not block CI.';

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_smart_selection_decisions_org_created
  ON smart_selection_decisions(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_smart_selection_decisions_org_repo_pr
  ON smart_selection_decisions(organization_id, repository, pr_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_smart_selection_decisions_mode
  ON smart_selection_decisions(organization_id, mode, created_at DESC);

-- Used by the Phase D circuit breaker query: "active-mode false negatives in last 7 days"
CREATE INDEX IF NOT EXISTS idx_smart_selection_decisions_active_fn
  ON smart_selection_decisions(organization_id, created_at DESC)
  WHERE mode = 'active' AND (metrics->>'false_negatives')::int > 0;

-- =====================================================
-- Row-Level Security
-- =====================================================
ALTER TABLE smart_selection_decisions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their org's decisions
CREATE POLICY "smart_selection_decisions_select_org_member"
  ON smart_selection_decisions FOR SELECT
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- Policy: Service accounts (CI ingest) and org members can insert
CREATE POLICY "smart_selection_decisions_insert_service"
  ON smart_selection_decisions FOR INSERT
  WITH CHECK (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- Policy: Admins can delete (e.g., to remove test data)
CREATE POLICY "smart_selection_decisions_delete_admin"
  ON smart_selection_decisions FOR DELETE
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
  );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- 1. Confirm table + RLS:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'smart_selection_decisions';

-- 2. List policies:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'smart_selection_decisions';

-- 3. Phase D circuit-breaker query (smoke):
-- SELECT COUNT(*) FROM smart_selection_decisions
-- WHERE organization_id = $1
--   AND mode = 'active'
--   AND created_at > NOW() - INTERVAL '7 days'
--   AND (metrics->>'false_negatives')::int > 0;
