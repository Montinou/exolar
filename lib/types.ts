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

export interface DashboardMetrics {
  total_executions: number
  pass_rate: number
  failure_rate: number
  avg_duration_ms: number
  critical_failures: number
  last_24h_executions: number
  failure_volume: number
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
