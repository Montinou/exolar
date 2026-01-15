// ============================================
// Shared Types
// ============================================

/**
 * Log entry captured during test execution
 */
export interface LogEntry {
  timestamp: number
  level: "info" | "warn" | "error" | "debug"
  source: string
  message: string
}

/**
 * AI failure context for LLM-powered troubleshooting
 * Captures structured failure data for AI analysis
 */
export interface AIFailureContext {
  test_id: string
  timestamp: string
  file: string
  suite: string[]
  test: string
  error: {
    message: string
    type: string
    location: string
  }
  steps: string[]
  last_step: string
  duration_ms: number
  retries: number
  last_api?: {
    method: string
    url: string
    status: number
    operation?: string
  }
  page_url?: string
  browser?: string
  logs?: Array<{
    timestamp: number
    level: string
    source: string
    message: string
    data?: Record<string, unknown>
  }>
  execution?: {
    run_id: string
    branch: string
    commit_sha: string
  }
}

// ============================================
// Database Entity Types (Read)
// ============================================

export interface TestExecution {
  id: number
  run_id: string
  branch: string
  commit_sha: string
  commit_message: string | null
  triggered_by: string
  workflow_name: string
  suite: string | null
  status: "success" | "failure" | "running"
  total_tests: number
  passed: number
  failed: number
  skipped: number
  duration_ms: number | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export interface TestResult {
  id: number
  execution_id: number
  test_name: string
  test_file: string
  test_signature: string | null
  status: "passed" | "failed" | "skipped" | "timedout"
  duration_ms: number
  is_critical: boolean
  is_flaky?: boolean
  error_message: string | null
  stack_trace: string | null
  browser: string
  retry_count: number
  logs: LogEntry[] | null
  ai_context?: AIFailureContext | null
  started_at: string
  completed_at: string | null
  created_at: string
  artifacts?: TestArtifact[]
}

export interface TestArtifact {
  id: number
  test_result_id: number
  type: "video" | "trace" | "screenshot"
  r2_key: string
  r2_url: string
  file_size_bytes: number | null
  mime_type: string | null
  created_at: string
}

// ============================================
// Dashboard Aggregate Types
// ============================================

export interface LatestPassRate {
  total_tests: number
  passed_tests: number
  failed_tests: number
  skipped_tests: number
}

export interface DashboardMetrics {
  total_executions: number
  pass_rate: number
  failure_rate: number
  avg_duration_ms: number
  critical_failures: number
  last_24h_executions: number
  failure_volume: number
  latestPassRate: LatestPassRate | null
  flakyTests: number
}

export interface TrendData {
  date: string
  passed: number
  failed: number
  total: number
}

export interface FailureTrendData {
  date: string
  failure_rate: number
  total_tests: number
  failed_tests: number
}

// ============================================
// Branch Accordion View Types
// ============================================

/**
 * Suite execution result for accordion view
 */
export interface SuiteResult {
  suite: string
  results: Array<{
    executionId: number
    status: "success" | "failure" | "running"
    startedAt: string
  }>
}

/**
 * Branch group for accordion view
 */
export interface BranchGroup {
  branch: string
  commitMessages: string[]
  lastActivity: string
  suiteResults: SuiteResult[]
}

// ============================================
// Request Types for POST /api/test-results
// ============================================

/**
 * Execution metadata from CI environment
 */
export interface ExecutionRequest {
  run_id: string
  branch: string
  commit_sha: string
  commit_message?: string
  triggered_by?: string
  workflow_name?: string
  suite?: string
  reporter?: string // Reporter name for tech stack detection (e.g., "@playwright/test", "cypress")
  status: "success" | "failure" | "running"
  total_tests: number
  passed: number
  failed: number
  skipped: number
  duration_ms?: number
  started_at: string
  completed_at?: string
}

/**
 * Individual test result from Playwright
 */
export interface TestResultRequest {
  test_name: string
  test_file: string
  status: "passed" | "failed" | "skipped" | "timedout"
  duration_ms: number
  is_critical?: boolean
  error_message?: string
  stack_trace?: string
  browser?: string
  retry_count?: number
  started_at?: string
  completed_at?: string
  logs?: LogEntry[]
  ai_context?: AIFailureContext
}

/**
 * Artifact reference (already uploaded to R2)
 */
// Incoming artifact request from reporter (base64 data)
export interface ArtifactUploadRequest {
  test_name: string
  test_file: string
  type: "screenshot" | "trace" | "video"
  filename: string
  data: string // base64 encoded file data
  mime_type?: string
  size_bytes?: number
}

// Artifact for database insertion (after R2 upload)
export interface ArtifactRequest {
  test_name: string
  test_file: string
  type: "screenshot" | "trace" | "video"
  filename: string
  r2_key: string
  mime_type?: string
  size_bytes?: number
}

/**
 * Complete ingestion request payload
 */
export interface IngestRequest {
  execution: ExecutionRequest
  results: TestResultRequest[]
  artifacts?: ArtifactRequest[]
}

/**
 * Response from ingestion endpoint
 */
export interface IngestResponse {
  success: boolean
  execution_id?: number
  results_count?: number
  artifacts_count?: number
  error?: string
}

// ============================================
// Search and History Types (Phase 04)
// ============================================

/**
 * Aggregated test search result
 */
export interface TestSearchResult {
  test_signature: string
  test_name: string
  test_file: string
  run_count: number
  last_run: string
  last_status: string
  pass_rate: number
}

/**
 * Test history item with execution context
 */
export interface TestHistoryItem extends TestResult {
  branch: string
  commit_sha: string
  execution_status: string
}

/**
 * Test statistics aggregated across all runs
 */
export interface TestStatistics {
  total_runs: number
  pass_rate: number
  avg_duration_ms: number
  flaky_rate: number
  last_failure: string | null
}

/**
 * Complete test history response
 */
export interface TestHistoryResponse {
  test_signature: string
  test_name: string
  test_file: string
  statistics: TestStatistics
  history: TestHistoryItem[]
}

// ============================================
// Flakiness Tracking Types (Phase 06)
// ============================================

/**
 * Historical flakiness data for a specific test
 */
export interface TestFlakinessHistory {
  id: number
  test_signature: string
  test_name: string
  test_file: string
  total_runs: number
  flaky_runs: number
  passed_runs: number
  failed_runs: number
  flakiness_rate: number
  avg_duration_ms: number
  last_flaky_at: string | null
  last_passed_at: string | null
  last_failed_at: string | null
  last_flaky_branch: string | null
  first_seen_at: string
  updated_at: string
}

/**
 * Summary of flakiness across all tests
 */
export interface FlakinessSummary {
  total_flaky_tests: number
  avg_flakiness_rate: number
  most_flaky_tests: TestFlakinessHistory[]
}

/**
 * Response from flakiness API endpoint
 */
export interface FlakinessResponse {
  summary: FlakinessSummary
  tests: TestFlakinessHistory[]
}

// ============================================
// Reliability Score Types
// ============================================

/**
 * Overall test suite reliability score (0-100)
 * Formula: (PassRate × 0.4) + ((1 - FlakyRate) × 0.3) + (DurationStability × 0.3)
 */
export interface ReliabilityScore {
  score: number
  breakdown: {
    passRateContribution: number
    flakinessContribution: number
    stabilityContribution: number
  }
  rawMetrics: {
    passRate: number
    flakyRate: number
    durationCV: number // coefficient of variation
  }
  trend: number // change from previous period (-100 to +100)
  status: "healthy" | "warning" | "critical"
}

// ============================================
// Performance Regression Types
// ============================================

/**
 * Historical performance baseline for a specific test
 * Updated from rolling 30-day average
 */
export interface TestBaseline {
  id: number
  testSignature: string
  testName: string
  testFile: string
  baselineDurationMs: number
  p50DurationMs: number | null
  p95DurationMs: number | null
  sampleCount: number
  firstSeenAt: string
  lastUpdatedAt: string
}

/**
 * Test that has regressed beyond the threshold
 * Severity: critical (>50%), warning (20-50%)
 */
export interface PerformanceRegression {
  testName: string
  testFile: string
  testSignature: string
  currentAvgMs: number
  baselineDurationMs: number
  regressionPercent: number
  severity: "critical" | "warning"
  recentRuns: number
  trend: "increasing" | "stable" | "decreasing"
}

/**
 * Summary of all performance regressions for an org
 */
export interface PerformanceRegressionSummary {
  totalRegressions: number
  criticalCount: number
  warningCount: number
  regressions: PerformanceRegression[]
}

/**
 * Duration history point for trend chart
 */
export interface DurationHistoryPoint {
  date: string
  avgDuration: number
  runCount: number
}

// ============================================
// Comparative Run Analysis Types
// ============================================

/**
 * Test diff category indicating what changed between baseline and current
 */
export type TestDiffCategory = 'new_failure' | 'fixed' | 'new_test' | 'removed_test' | 'unchanged';

/**
 * Individual test comparison item showing both baseline and current states
 */
export interface TestComparisonItem {
  testSignature: string
  testName: string
  testFile: string
  baselineStatus: 'passed' | 'failed' | 'skipped' | null
  currentStatus: 'passed' | 'failed' | 'skipped' | null
  baselineDurationMs: number | null
  currentDurationMs: number | null
  durationDeltaMs: number | null
  durationDeltaPercent: number | null
  diffCategory: TestDiffCategory
  durationCategory: 'regression' | 'improvement' | 'stable' | null
}

/**
 * Performance summary for execution comparison
 */
export interface PerformanceSummary {
  regressions: number
  improvements: number
  stable: number
  thresholdPct: number
}

/**
 * Summary statistics comparing two executions
 */
export interface ComparisonSummary {
  baselinePassRate: number
  currentPassRate: number
  passRateDelta: number
  baselineTotalTests: number
  currentTotalTests: number
  testCountDelta: number
  baselineAvgDurationMs: number
  currentAvgDurationMs: number
  durationDeltaMs: number
  durationDeltaPercent: number
  newFailures: number
  fixed: number
  newTests: number
  removedTests: number
  unchanged: number
}

/**
 * Execution info for comparison display
 */
export interface ComparisonExecutionInfo {
  id: number
  branch: string
  commitSha: string
  suite: string | null
  status: string
  startedAt: string
  totalTests: number
  passed: number
  failed: number
}

/**
 * Complete comparison result between two executions
 */
export interface ComparisonResult {
  baseline: ComparisonExecutionInfo
  current: ComparisonExecutionInfo
  summary: ComparisonSummary
  tests: TestComparisonItem[]
}

// ============================================
// MCP Installation Config Types
// ============================================

/**
 * IDE-specific configuration snippet for MCP server installation
 */
export interface IDEConfigSnippet {
  config_path: string
  config_path_windows?: string
  config_snippet: {
    mcpServers: Record<
      string,
      {
        command: string
        args: string[]
        env?: Record<string, string>
      }
    >
  }
  note?: string
}

/**
 * CLI commands for MCP server installation
 */
export interface CLICommands {
  add_command: string
  auth_command: string
  status_command: string
  logout_command: string
}

/**
 * Complete installation configuration for all supported IDEs
 */
export interface InstallationConfig {
  organization: string
  npm_package: string
  claude_desktop: IDEConfigSnippet
  cursor: IDEConfigSnippet
  claude_code_cli: CLICommands
  setup_steps: string[]
  credentials_location: string
  token_expiry: string
  dashboard_url: string
  docs_url: string
}

// ============================================
// Failure Classification Types (Auto-Triage)
// ============================================

/**
 * A weighted signal that contributes to FLAKE vs BUG classification
 */
export interface ClassificationSignal {
  signal: string
  value: number | boolean | string
  weight: number
  category: "flake" | "bug"
}

/**
 * Current failure details for classification
 */
export interface FailureDetails {
  execution_id: number
  result_id: number
  status: string
  retry_count: number
  error_type: string | null
  error_message: string | null
  failed_step: string | null
  duration_ms: number
  browser: string
  occurred_at: string
}

/**
 * Historical metrics for a test (aggregated from flakiness history)
 */
export interface ClassificationHistoricalMetrics {
  total_runs: number
  flaky_runs: number
  failed_runs: number
  passed_runs: number
  flakiness_rate: number
  failure_rate: number
  avg_duration_ms: number
  last_flaky_at: string | null
  last_passed_at: string | null
  last_failed_at: string | null
  first_seen_at: string
}

/**
 * A single run in the recent history
 */
export interface RecentRun {
  execution_id: number
  status: string
  retry_count: number
  duration_ms: number
  branch: string
  occurred_at: string
}

/**
 * Complete failure classification result
 */
export interface FailureClassification {
  test_id: string
  test_signature: string
  current_failure: FailureDetails
  historical_metrics: ClassificationHistoricalMetrics
  recent_runs: RecentRun[]
  classification_signals: {
    flake_indicators: ClassificationSignal[]
    bug_indicators: ClassificationSignal[]
  }
  suggested_classification: "FLAKE" | "BUG" | "UNKNOWN"
  confidence: number
  reasoning: string
}

/**
 * Options for querying failure classification
 */
export interface ClassificationOptions {
  testId?: number
  executionId?: number
  testName?: string
  testFile?: string
}

// ============================================
// Suite and Test Tracking Types (Phase 14)
// ============================================

/**
 * Supported test frameworks/tech stacks
 */
export type TechStack =
  | "playwright"
  | "cypress"
  | "vitest"
  | "jest"
  | "mocha"
  | "pytest"
  | "other"

/**
 * Registered suite for an organization
 */
export interface OrgSuite {
  id: number
  organization_id: number
  name: string
  tech_stack: TechStack
  description: string | null
  repository_url: string | null
  is_active: boolean
  test_count: number
  last_execution_id: number | null
  last_execution_at: string | null
  first_seen_at: string
  updated_at: string
}

/**
 * Individual test tracked within a suite
 */
export interface SuiteTest {
  id: number
  organization_id: number
  suite_id: number | null
  test_signature: string
  test_name: string
  test_file: string
  is_active: boolean
  is_critical: boolean
  run_count: number
  pass_count: number
  fail_count: number
  skip_count: number
  last_status: "passed" | "failed" | "skipped" | "timedout" | null
  last_duration_ms: number | null
  avg_duration_ms: number
  first_seen_at: string
  last_seen_at: string
  updated_at: string
}

/**
 * Suite with aggregated test statistics
 */
export interface SuiteWithStats extends OrgSuite {
  active_test_count: number
  inactive_test_count: number
  pass_rate: number
  avg_test_duration_ms: number
}

/**
 * Suite test with suite name (for display)
 */
export interface SuiteTestWithSuite extends SuiteTest {
  suite_name: string | null
}

/**
 * Options for querying suites
 */
export interface GetSuitesOptions {
  techStack?: TechStack
  isActive?: boolean
  limit?: number
  offset?: number
}

/**
 * Options for querying suite tests
 */
export interface GetSuiteTestsOptions {
  suiteId?: number
  suiteName?: string
  isActive?: boolean
  isCritical?: boolean
  testFile?: string
  limit?: number
  offset?: number
}

/**
 * Request to update suite metadata
 */
export interface UpdateSuiteRequest {
  description?: string
  repository_url?: string
  tech_stack?: TechStack
  is_active?: boolean
}

// ============================================
// Mock API Endpoint Types
// ============================================

/**
 * Mock interface container - groups related mock routes
 * Public URL: /api/mock/{org-slug}/{interface-slug}/
 */
export interface MockInterface {
  id: number
  organization_id: number
  name: string
  slug: string
  description: string | null
  is_active: boolean
  rate_limit_rpm: number
  created_by: number | null
  created_at: string
  updated_at: string
}

/**
 * Mock interface with aggregated statistics
 */
export interface MockInterfaceWithStats extends MockInterface {
  total_routes: number
  total_rules: number
  total_requests: number
  requests_last_24h: number
  last_request_at: string | null
}

/**
 * Mock route - path + method definition within an interface
 * Supports: exact (/users), params (/users/:id), wildcards (/api/*)
 */
export interface MockRoute {
  id: number
  interface_id: number
  path_pattern: string
  method: string
  description: string | null
  is_active: boolean
  priority: number
  // JSON Schema fields
  request_schema: Record<string, unknown> | null
  response_schema: Record<string, unknown> | null
  validate_request: boolean
  created_at: string
  updated_at: string
}

/**
 * Mock route with rule count for display
 */
export interface MockRouteWithRuleCount extends MockRoute {
  rule_count: number
  hit_count: number
}

/**
 * Mock response rule - matching conditions + response configuration
 * Supports templating: {{request.body.name}}, {{uuid}}, {{timestamp}}
 */
export interface MockResponseRule {
  id: number
  route_id: number
  name: string
  // Matching conditions (null = match any)
  match_headers: Record<string, string> | null
  match_query: Record<string, string> | null
  match_body: Record<string, unknown> | null
  match_body_contains: string | null
  // Response configuration
  response_status: number
  response_headers: Record<string, string>
  response_body: string | null
  response_delay_ms: number
  // Metadata
  priority: number
  is_active: boolean
  hit_count: number
  last_hit_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Mock request log - for debugging and analytics
 */
export interface MockRequestLog {
  id: number
  interface_id: number
  route_id: number | null
  rule_id: number | null
  method: string
  path: string
  headers: Record<string, string> | null
  query_params: Record<string, string> | null
  body: string | null
  response_status: number | null
  response_body: string | null
  matched: boolean
  validation_errors: Array<{ path: string; message: string; keyword: string }> | null
  request_at: string
  response_time_ms: number | null
}

/**
 * Request to create a mock interface
 */
export interface CreateMockInterfaceRequest {
  name: string
  slug: string
  description?: string
  rate_limit_rpm?: number
}

/**
 * Request to update a mock interface
 */
export interface UpdateMockInterfaceRequest {
  name?: string
  slug?: string
  description?: string
  is_active?: boolean
  rate_limit_rpm?: number
}

/**
 * Request to create a mock route
 */
export interface CreateMockRouteRequest {
  path_pattern: string
  method: string
  description?: string
  priority?: number
  // JSON Schema fields
  request_schema?: Record<string, unknown>
  response_schema?: Record<string, unknown>
  validate_request?: boolean
}

/**
 * Request to update a mock route
 */
export interface UpdateMockRouteRequest {
  path_pattern?: string
  method?: string
  description?: string
  is_active?: boolean
  priority?: number
  // JSON Schema fields
  request_schema?: Record<string, unknown> | null
  response_schema?: Record<string, unknown> | null
  validate_request?: boolean
}

/**
 * Request to create a mock response rule
 */
export interface CreateMockResponseRuleRequest {
  name: string
  match_headers?: Record<string, string>
  match_query?: Record<string, string>
  match_body?: Record<string, unknown>
  match_body_contains?: string
  response_status: number
  response_headers?: Record<string, string>
  response_body?: string
  response_delay_ms?: number
  priority?: number
}

/**
 * Request to update a mock response rule
 */
export interface UpdateMockResponseRuleRequest {
  name?: string
  match_headers?: Record<string, string> | null
  match_query?: Record<string, string> | null
  match_body?: Record<string, unknown> | null
  match_body_contains?: string | null
  response_status?: number
  response_headers?: Record<string, string>
  response_body?: string | null
  response_delay_ms?: number
  is_active?: boolean
  priority?: number
}

/**
 * Context for matching mock requests
 */
export interface MockRequestContext {
  headers: Record<string, string>
  query: Record<string, string>
  body: unknown
  params: Record<string, string>
}

/**
 * Result of finding a matching route
 */
export interface MockRouteMatch {
  interface: MockInterface
  route: MockRoute
  params: Record<string, string>
}

// ============================================
// Mock Webhook Types
// ============================================

/**
 * Webhook action - triggers external HTTP request when a rule matches
 */
export interface MockWebhookAction {
  id: number
  rule_id: number
  name: string
  // Target configuration
  target_url: string
  target_method: string
  target_headers: Record<string, string>
  target_body: string | null
  // Options
  forward_request_body: boolean
  forward_request_headers: boolean
  timeout_ms: number
  retry_count: number
  // Metadata
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Webhook execution log
 */
export interface MockWebhookLog {
  id: number
  action_id: number
  request_log_id: number | null
  // Request sent
  request_url: string
  request_method: string
  request_headers: Record<string, string> | null
  request_body: string | null
  // Response received
  response_status: number | null
  response_headers: Record<string, string> | null
  response_body: string | null
  // Execution details
  success: boolean
  error_message: string | null
  duration_ms: number | null
  retry_attempt: number
  executed_at: string
}

/**
 * Request to create a webhook action
 */
export interface CreateMockWebhookActionRequest {
  name: string
  target_url: string
  target_method?: string
  target_headers?: Record<string, string>
  target_body?: string
  forward_request_body?: boolean
  forward_request_headers?: boolean
  timeout_ms?: number
  retry_count?: number
}

/**
 * Request to update a webhook action
 */
export interface UpdateMockWebhookActionRequest {
  name?: string
  target_url?: string
  target_method?: string
  target_headers?: Record<string, string>
  target_body?: string | null
  forward_request_body?: boolean
  forward_request_headers?: boolean
  timeout_ms?: number
  retry_count?: number
  is_active?: boolean
}
