-- =====================================================
-- Migration 027: Add missing RLS policies and bound text fields
-- =====================================================
-- Covers audit findings M-9, M-10, M-11, M-4
--
-- PREREQUISITES:
--   - 010_add_rls_policies.sql (is_org_member, is_system_admin, is_service_account)
--   - 015_add_vector_support.sql (failure_clusters, failure_cluster_members)
--   - 019_add_global_patterns.sql (error_patterns, error_pattern_occurrences, test_failure_stats)
--   - 020_add_mock_endpoints.sql (mock_interfaces, mock_routes, mock_response_rules,
--                                  mock_request_logs, mock_rate_limit_hits)
--   - 022_add_mock_webhooks.sql (mock_webhook_actions, mock_webhook_logs)
--   - 024_update_rls_for_superadmin.sql (is_superadmin)
--
-- ROLLBACK:
--   ALTER TABLE failure_clusters          DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE failure_cluster_members   DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE error_patterns            DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE error_pattern_occurrences DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE test_failure_stats        DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE mock_interfaces           DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE mock_routes               DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE mock_response_rules       DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE mock_request_logs         DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE mock_rate_limit_hits      DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE mock_webhook_actions      DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE mock_webhook_logs         DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE test_results DROP CONSTRAINT IF EXISTS chk_error_message_length;
--   ALTER TABLE test_results DROP CONSTRAINT IF EXISTS chk_stack_trace_length;
-- =====================================================

-- =====================================================
-- M-9: RLS on failure_clusters + failure_cluster_members
-- =====================================================
-- failure_clusters has no direct organization_id; access is governed
-- via its execution_id -> test_executions.organization_id.

ALTER TABLE failure_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "failure_clusters_select_via_execution"
  ON failure_clusters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM test_executions te
      WHERE te.id = failure_clusters.execution_id
        AND (
          is_org_member(te.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

CREATE POLICY "failure_clusters_insert_via_execution"
  ON failure_clusters FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM test_executions te
      WHERE te.id = execution_id
        AND (
          is_org_member(te.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

-- failure_cluster_members has no direct org link; access is governed
-- via cluster_id -> failure_clusters -> test_executions.

ALTER TABLE failure_cluster_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "failure_cluster_members_select_via_cluster"
  ON failure_cluster_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM failure_clusters fc
      JOIN test_executions te ON te.id = fc.execution_id
      WHERE fc.id = failure_cluster_members.cluster_id
        AND (
          is_org_member(te.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

CREATE POLICY "failure_cluster_members_insert_via_cluster"
  ON failure_cluster_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM failure_clusters fc
      JOIN test_executions te ON te.id = fc.execution_id
      WHERE fc.id = cluster_id
        AND (
          is_org_member(te.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

-- =====================================================
-- M-10: RLS on error_patterns tables
-- =====================================================
-- error_patterns has organization_id directly.

ALTER TABLE error_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "error_patterns_select_org_member"
  ON error_patterns FOR SELECT
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

CREATE POLICY "error_patterns_insert_org_member"
  ON error_patterns FOR INSERT
  WITH CHECK (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

CREATE POLICY "error_patterns_update_org_member"
  ON error_patterns FOR UPDATE
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- error_pattern_occurrences has no direct org column; governed via pattern_id.

ALTER TABLE error_pattern_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "error_pattern_occurrences_select_via_pattern"
  ON error_pattern_occurrences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM error_patterns ep
      WHERE ep.id = error_pattern_occurrences.pattern_id
        AND (
          is_org_member(ep.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

CREATE POLICY "error_pattern_occurrences_insert_via_pattern"
  ON error_pattern_occurrences FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM error_patterns ep
      WHERE ep.id = pattern_id
        AND (
          is_org_member(ep.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

-- test_failure_stats has organization_id directly.

ALTER TABLE test_failure_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "test_failure_stats_select_org_member"
  ON test_failure_stats FOR SELECT
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

CREATE POLICY "test_failure_stats_insert_org_member"
  ON test_failure_stats FOR INSERT
  WITH CHECK (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

CREATE POLICY "test_failure_stats_update_org_member"
  ON test_failure_stats FOR UPDATE
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

-- =====================================================
-- M-11: RLS on mock tables
-- =====================================================
-- mock_interfaces has organization_id directly.
-- Write operations (INSERT/UPDATE/DELETE) exclude service accounts —
-- mocks are user-managed configuration, not CI-ingested data.

ALTER TABLE mock_interfaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mock_interfaces_select_org_member"
  ON mock_interfaces FOR SELECT
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
    OR is_service_account()
  );

CREATE POLICY "mock_interfaces_insert_org_member"
  ON mock_interfaces FOR INSERT
  WITH CHECK (
    is_org_member(organization_id)
    OR is_system_admin()
  );

CREATE POLICY "mock_interfaces_update_org_member"
  ON mock_interfaces FOR UPDATE
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
  );

CREATE POLICY "mock_interfaces_delete_org_member"
  ON mock_interfaces FOR DELETE
  USING (
    is_org_member(organization_id)
    OR is_system_admin()
  );

-- mock_routes has no direct org column; governed via interface_id.

ALTER TABLE mock_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mock_routes_select_via_interface"
  ON mock_routes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mock_interfaces mi
      WHERE mi.id = mock_routes.interface_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

CREATE POLICY "mock_routes_insert_via_interface"
  ON mock_routes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mock_interfaces mi
      WHERE mi.id = interface_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
        )
    )
  );

CREATE POLICY "mock_routes_update_via_interface"
  ON mock_routes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM mock_interfaces mi
      WHERE mi.id = mock_routes.interface_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
        )
    )
  );

CREATE POLICY "mock_routes_delete_via_interface"
  ON mock_routes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM mock_interfaces mi
      WHERE mi.id = mock_routes.interface_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
        )
    )
  );

-- mock_response_rules governed via route_id -> mock_routes -> mock_interfaces.

ALTER TABLE mock_response_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mock_response_rules_select_via_route"
  ON mock_response_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM mock_routes mr
      JOIN mock_interfaces mi ON mi.id = mr.interface_id
      WHERE mr.id = mock_response_rules.route_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

CREATE POLICY "mock_response_rules_insert_via_route"
  ON mock_response_rules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM mock_routes mr
      JOIN mock_interfaces mi ON mi.id = mr.interface_id
      WHERE mr.id = route_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
        )
    )
  );

CREATE POLICY "mock_response_rules_update_via_route"
  ON mock_response_rules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM mock_routes mr
      JOIN mock_interfaces mi ON mi.id = mr.interface_id
      WHERE mr.id = mock_response_rules.route_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
        )
    )
  );

CREATE POLICY "mock_response_rules_delete_via_route"
  ON mock_response_rules FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM mock_routes mr
      JOIN mock_interfaces mi ON mi.id = mr.interface_id
      WHERE mr.id = mock_response_rules.route_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
        )
    )
  );

-- mock_request_logs has interface_id directly.
-- Service accounts (CI runners hitting mock endpoints) can insert logs.

ALTER TABLE mock_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mock_request_logs_select_via_interface"
  ON mock_request_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mock_interfaces mi
      WHERE mi.id = mock_request_logs.interface_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

CREATE POLICY "mock_request_logs_insert_via_interface"
  ON mock_request_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mock_interfaces mi
      WHERE mi.id = interface_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

-- mock_rate_limit_hits has interface_id directly.
-- Written at request time, readable by org members.

ALTER TABLE mock_rate_limit_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mock_rate_limit_hits_select_via_interface"
  ON mock_rate_limit_hits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mock_interfaces mi
      WHERE mi.id = mock_rate_limit_hits.interface_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

CREATE POLICY "mock_rate_limit_hits_insert_via_interface"
  ON mock_rate_limit_hits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mock_interfaces mi
      WHERE mi.id = interface_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

-- mock_webhook_actions governed via rule_id -> mock_response_rules -> mock_routes -> mock_interfaces.

ALTER TABLE mock_webhook_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mock_webhook_actions_select_via_rule"
  ON mock_webhook_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM mock_response_rules rr
      JOIN mock_routes mr ON mr.id = rr.route_id
      JOIN mock_interfaces mi ON mi.id = mr.interface_id
      WHERE rr.id = mock_webhook_actions.rule_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

CREATE POLICY "mock_webhook_actions_insert_via_rule"
  ON mock_webhook_actions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM mock_response_rules rr
      JOIN mock_routes mr ON mr.id = rr.route_id
      JOIN mock_interfaces mi ON mi.id = mr.interface_id
      WHERE rr.id = rule_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
        )
    )
  );

CREATE POLICY "mock_webhook_actions_update_via_rule"
  ON mock_webhook_actions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM mock_response_rules rr
      JOIN mock_routes mr ON mr.id = rr.route_id
      JOIN mock_interfaces mi ON mi.id = mr.interface_id
      WHERE rr.id = mock_webhook_actions.rule_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
        )
    )
  );

CREATE POLICY "mock_webhook_actions_delete_via_rule"
  ON mock_webhook_actions FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM mock_response_rules rr
      JOIN mock_routes mr ON mr.id = rr.route_id
      JOIN mock_interfaces mi ON mi.id = mr.interface_id
      WHERE rr.id = mock_webhook_actions.rule_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
        )
    )
  );

-- mock_webhook_logs governed via action_id -> mock_webhook_actions -> ... -> mock_interfaces.
-- Service accounts can insert execution logs.

ALTER TABLE mock_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mock_webhook_logs_select_via_action"
  ON mock_webhook_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM mock_webhook_actions wa
      JOIN mock_response_rules rr ON rr.id = wa.rule_id
      JOIN mock_routes mr ON mr.id = rr.route_id
      JOIN mock_interfaces mi ON mi.id = mr.interface_id
      WHERE wa.id = mock_webhook_logs.action_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

CREATE POLICY "mock_webhook_logs_insert_via_action"
  ON mock_webhook_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM mock_webhook_actions wa
      JOIN mock_response_rules rr ON rr.id = wa.rule_id
      JOIN mock_routes mr ON mr.id = rr.route_id
      JOIN mock_interfaces mi ON mi.id = mr.interface_id
      WHERE wa.id = action_id
        AND (
          is_org_member(mi.organization_id)
          OR is_system_admin()
          OR is_service_account()
        )
    )
  );

-- =====================================================
-- M-4: Bound text fields on test_results
-- =====================================================
-- error_message: 8 KB limit — adequate for structured error text.
-- stack_trace: 64 KB limit — generous for multi-frame traces.

ALTER TABLE test_results
  ADD CONSTRAINT chk_error_message_length
  CHECK (length(error_message) <= 8192);

ALTER TABLE test_results
  ADD CONSTRAINT chk_stack_trace_length
  CHECK (length(stack_trace) <= 65536);
