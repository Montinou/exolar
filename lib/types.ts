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
  avg_duration_ms: number
  critical_failures: number
  last_24h_executions: number
}

export interface TrendData {
  date: string
  passed: number
  failed: number
  total: number
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
