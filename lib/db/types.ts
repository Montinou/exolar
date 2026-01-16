// lib/db/types.ts
// Local type definitions for db module
// Note: Main types are still imported from lib/types.ts

// ============================================
// User Types
// ============================================

export interface DashboardUser {
  id: number
  email: string
  name: string | null
  role: "admin" | "viewer"
  is_superadmin: boolean
  invited_by: number | null
  default_org_id: number | null
  created_at: string
  updated_at: string
}

export interface Invite {
  id: number
  email: string
  role: "admin" | "viewer"
  invited_by: number
  organization_id: number | null
  used: boolean
  created_at: string
}

// ============================================
// Organization Types
// ============================================

export interface Organization {
  id: number
  name: string
  slug: string
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: number
  organization_id: number
  user_id: number
  role: "owner" | "admin" | "viewer"
  joined_at: string
  user_email?: string
  user_name?: string
}

export interface OrganizationWithRole extends Organization {
  user_role?: "owner" | "admin" | "viewer"
}

// ============================================
// Query Types
// ============================================

export interface DateRangeFilter {
  from?: string // ISO date string
  to?: string // ISO date string
}

export interface FailedTestResult {
  test_name: string
  test_file: string
  error_message: string | null
  duration_ms: number
  retry_count: number
  stack_trace?: string | null
}

export interface ExecutionSummary {
  execution: import("../types").TestExecution
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
    pass_rate: number
    duration_ms: number
  }
  error_distribution: Array<{ error_pattern: string; count: number }>
  files_affected: Array<{ file: string; failed: number; passed: number }>
}

export type TrendPeriod = "hour" | "day" | "week" | "month"

export interface TrendOptions {
  period?: TrendPeriod
  count?: number // Number of periods to look back
  days?: number // Deprecated: use count + period instead
  from?: string // Explicit start date (ISO 8601)
  to?: string // Explicit end date (ISO 8601)
}

export interface TrendDataPoint {
  period: string // ISO date or datetime depending on granularity
  executions: number // Total runs in this period
  passed: number
  failed: number
  skipped: number
  pass_rate: number // 0-100
}

export interface BranchStatistics {
  branch: string
  last_run: string | null
  execution_count: number
  pass_rate: number // Execution-level: % of executions that succeeded
  latest_pass_rate: number // Test-level: % of tests that passed in latest execution
  last_status: "success" | "failure" | "running" | null
}

export interface SuiteStatistics {
  suite: string
  last_run: string | null
  execution_count: number
  pass_rate: number
  last_status: "success" | "failure" | "running" | null
}

export interface GetFlakiestTestsOptions {
  limit?: number
  minRuns?: number
  since?: string
  branch?: string
  suite?: string
  includeResolved?: boolean
  executionId?: number // Filter to flaky tests from specific execution (for lastRunOnly mode)
}

export interface GetFlakinessSummaryOptions {
  branch?: string
  suite?: string
  since?: string
  lastRunOnly?: boolean // Filter to latest execution matching branch/suite filters
}

export interface SlowestTest {
  test_signature: string
  test_name: string
  test_file: string
  avg_duration_ms: number
  run_count: number
}

export interface SuitePassRate {
  suite: string
  total_runs: number
  pass_rate: number
  failed_tests: string[]
  failed_count: number
}

export interface OrgApiKey {
  id: number
  organization_id: number
  name: string
  key_prefix: string
  created_by: number | null
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
}

export interface OrgApiKeyWithHash extends OrgApiKey {
  key_hash: string
}

export interface ReliabilityScoreOptions {
  from?: string
  to?: string
  branch?: string
  suite?: string
  lastRunOnly?: boolean // Filter to latest execution matching branch/suite filters
}

export interface PerformanceRegressionsOptions {
  threshold?: number // Default 0.20 (20%)
  hours?: number // Default 24
  branch?: string
  suite?: string
  limit?: number // Default 20
  sortBy?: "regression" | "duration" | "name" // Default 'regression'
}

export interface ErrorDistributionOptions {
  since?: string
  branch?: string
  suite?: string
  limit?: number
  groupBy?: "error_type" | "file" | "branch"
}

export interface ErrorDistributionItem {
  error_type: string
  count: number
  percentage: number
  example_message: string | null
}

export interface GetSlowestTestsOptions {
  limit?: number
  minRuns?: number
  from?: string
  to?: string
  branch?: string
  suite?: string
}

export interface GetSuitePassRatesOptions {
  from?: string
  to?: string
  branch?: string
}
