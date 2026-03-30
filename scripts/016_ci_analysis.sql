-- =====================================================
-- Migration 016: CI Analysis — Webhooks, Analysis Results, Auto-Heal, Auto-Bugs
-- =====================================================
-- Prerequisites: 009_add_organizations.sql, 010_add_rls_policies.sql
--
-- This migration adds the data layer for CI analysis workflows:
--   - org_webhooks: per-org webhook configuration for event notifications
--   - ci_analysis_results: analysis output produced per test execution
--   - ci_auto_heal_attempts: tracking of automated fix attempts per failure
--   - ci_auto_bugs: auto-reported bug records linked to analysis results
-- =====================================================

-- =====================================================
-- 1. org_webhooks
-- =====================================================
CREATE TABLE org_webhooks (
  id                SERIAL PRIMARY KEY,
  organization_id   INTEGER NOT NULL REFERENCES organizations(id),
  name              TEXT NOT NULL,
  url               TEXT NOT NULL,
  events            TEXT[] NOT NULL DEFAULT '{failure}',
  filters           JSONB DEFAULT '{}',
  secret_hash       TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Partial index: only active webhooks need fast org lookup
CREATE INDEX idx_webhooks_org_active
  ON org_webhooks (organization_id)
  WHERE is_active = true;

COMMENT ON TABLE org_webhooks IS 'Webhook endpoints configured per organization for CI event notifications';
COMMENT ON COLUMN org_webhooks.events IS 'Array of event types that trigger this webhook (e.g., failure, flake, healed)';
COMMENT ON COLUMN org_webhooks.filters IS 'Optional JSONB filters (e.g., branch, suite) to narrow delivery';
COMMENT ON COLUMN org_webhooks.secret_hash IS 'SHA-256 HMAC secret hash for payload signature verification';

-- =====================================================
-- 2. ci_analysis_results
-- =====================================================
CREATE TABLE ci_analysis_results (
  id                    SERIAL PRIMARY KEY,
  organization_id       INTEGER NOT NULL REFERENCES organizations(id),
  execution_id          INTEGER NOT NULL REFERENCES test_executions(id),
  action_plan           JSONB NOT NULL,
  total_failures        INTEGER NOT NULL,
  healable_count        INTEGER DEFAULT 0,
  bug_count             INTEGER DEFAULT 0,
  known_flake_count     INTEGER DEFAULT 0,
  infra_count           INTEGER DEFAULT 0,
  manual_review_count   INTEGER DEFAULT 0,
  overall_confidence    REAL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (execution_id)
);

-- Index for per-org time-ordered queries
CREATE INDEX idx_analysis_org_created
  ON ci_analysis_results (organization_id, created_at DESC);

COMMENT ON TABLE ci_analysis_results IS 'Analysis output produced for a test execution, including categorised failure counts and an action plan';
COMMENT ON COLUMN ci_analysis_results.action_plan IS 'JSONB action plan: list of recommended remediation steps per failure cluster';
COMMENT ON COLUMN ci_analysis_results.overall_confidence IS 'Aggregate confidence score (0.0–1.0) across all categorised failures';

-- =====================================================
-- 3. ci_auto_heal_attempts
-- =====================================================
CREATE TABLE ci_auto_heal_attempts (
  id                SERIAL PRIMARY KEY,
  analysis_id       INTEGER NOT NULL REFERENCES ci_analysis_results(id),
  test_signature    TEXT NOT NULL,
  fix_strategy      TEXT NOT NULL,
  attempt_number    INTEGER NOT NULL DEFAULT 1,
  status            TEXT NOT NULL DEFAULT 'pending',
  pr_url            TEXT,
  pr_number         INTEGER,
  error_log         TEXT,
  started_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  UNIQUE (analysis_id, test_signature, attempt_number)
);

COMMENT ON TABLE ci_auto_heal_attempts IS 'Tracks each automated fix attempt for a failing test signature within an analysis';
COMMENT ON COLUMN ci_auto_heal_attempts.status IS 'Current state: pending | in_progress | succeeded | failed | skipped';
COMMENT ON COLUMN ci_auto_heal_attempts.fix_strategy IS 'Strategy identifier applied (e.g., retry-flake, update-selector, add-wait)';

-- =====================================================
-- 4. ci_auto_bugs
-- =====================================================
CREATE TABLE ci_auto_bugs (
  id                      SERIAL PRIMARY KEY,
  analysis_id             INTEGER NOT NULL REFERENCES ci_analysis_results(id),
  issue_url               TEXT,
  issue_number            INTEGER,
  summary                 TEXT NOT NULL,
  root_cause_cluster      TEXT,
  affected_signatures     TEXT[],
  status                  TEXT NOT NULL DEFAULT 'reported',
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ci_auto_bugs IS 'Bug records automatically opened from CI analysis results';
COMMENT ON COLUMN ci_auto_bugs.root_cause_cluster IS 'Identifier for the failure cluster that produced this bug';
COMMENT ON COLUMN ci_auto_bugs.affected_signatures IS 'Array of test signatures grouped under this bug';
COMMENT ON COLUMN ci_auto_bugs.status IS 'Current state: reported | acknowledged | resolved | wont_fix';

-- =====================================================
-- RLS Policies
-- =====================================================
-- Relies on helper functions from 010_add_rls_policies.sql:
--   is_org_member(org_id), is_system_admin(), is_service_account()

-- ----- org_webhooks -----
ALTER TABLE org_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_webhooks_select_org_member"
  ON org_webhooks FOR SELECT
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

CREATE POLICY "org_webhooks_insert_org_member"
  ON org_webhooks FOR INSERT
  WITH CHECK (
    is_org_member(organization_id)
    OR is_system_admin()
  );

CREATE POLICY "org_webhooks_update_org_member"
  ON org_webhooks FOR UPDATE
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
  );

CREATE POLICY "org_webhooks_delete_org_member"
  ON org_webhooks FOR DELETE
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
  );

-- ----- ci_analysis_results -----
ALTER TABLE ci_analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ci_analysis_results_select_org_member"
  ON ci_analysis_results FOR SELECT
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

CREATE POLICY "ci_analysis_results_insert_service"
  ON ci_analysis_results FOR INSERT
  WITH CHECK (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- ----- ci_auto_heal_attempts -----
-- Access is governed via parent ci_analysis_results
ALTER TABLE ci_auto_heal_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ci_auto_heal_attempts_select_via_analysis"
  ON ci_auto_heal_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ci_analysis_results ar
      WHERE ar.id = ci_auto_heal_attempts.analysis_id
        AND (
          is_org_member(ar.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

CREATE POLICY "ci_auto_heal_attempts_insert_service"
  ON ci_auto_heal_attempts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ci_analysis_results ar
      WHERE ar.id = analysis_id
        AND (
          is_org_member(ar.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

CREATE POLICY "ci_auto_heal_attempts_update_service"
  ON ci_auto_heal_attempts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM ci_analysis_results ar
      WHERE ar.id = ci_auto_heal_attempts.analysis_id
        AND (
          is_org_member(ar.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

-- ----- ci_auto_bugs -----
-- Access is governed via parent ci_analysis_results
ALTER TABLE ci_auto_bugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ci_auto_bugs_select_via_analysis"
  ON ci_auto_bugs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ci_analysis_results ar
      WHERE ar.id = ci_auto_bugs.analysis_id
        AND (
          is_org_member(ar.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

CREATE POLICY "ci_auto_bugs_insert_service"
  ON ci_auto_bugs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ci_analysis_results ar
      WHERE ar.id = analysis_id
        AND (
          is_org_member(ar.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

-- =====================================================
-- ROLLBACK
-- =====================================================
-- ALTER TABLE ci_auto_bugs         DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE ci_auto_heal_attempts DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE ci_analysis_results  DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE org_webhooks         DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS ci_auto_bugs;
-- DROP TABLE IF EXISTS ci_auto_heal_attempts;
-- DROP TABLE IF EXISTS ci_analysis_results;
-- DROP TABLE IF EXISTS org_webhooks;
