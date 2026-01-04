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
