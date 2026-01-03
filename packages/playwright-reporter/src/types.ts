/**
 * Exolar Playwright Reporter - Type Definitions
 *
 * These types match the Exolar API schema for test result ingestion.
 */

/**
 * Configuration options for the Exolar reporter
 */
export interface ExolarReporterOptions {
  /**
   * API key for authentication.
   * Defaults to EXOLAR_API_KEY environment variable.
   */
  apiKey?: string

  /**
   * Dashboard API endpoint URL.
   * Defaults to EXOLAR_URL or https://exolar.qa
   */
  endpoint?: string

  /**
   * Only send results when there are failures.
   * Defaults to false (send all results).
   */
  onlyOnFailure?: boolean

  /**
   * Include artifacts (screenshots, traces, videos) in the upload.
   * Defaults to true.
   */
  includeArtifacts?: boolean

  /**
   * Maximum artifact size in bytes.
   * Artifacts larger than this will be skipped.
   * Defaults to 5MB (5 * 1024 * 1024).
   */
  maxArtifactSize?: number

  /**
   * Disable the reporter entirely.
   * Useful for local development override.
   * Defaults to false.
   */
  disabled?: boolean
}

/**
 * Log entry for structured test logging
 */
export interface LogEntry {
  timestamp: number
  level: "debug" | "info" | "warn" | "error" | "metric"
  source: string
  message: string
  data?: Record<string, unknown>
}

/**
 * AI-enriched failure context for Claude Code consumption
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
  logs?: LogEntry[]
  execution?: {
    run_id: string
    branch: string
    commit_sha: string
  }
}

/**
 * Execution metadata payload
 */
export interface ExecutionPayload {
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
 * Individual test result payload
 */
export interface TestResultPayload {
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
 * Artifact payload for screenshots, videos, traces
 */
export interface ArtifactPayload {
  test_name: string
  test_file: string
  type: "screenshot" | "trace" | "video"
  filename: string
  mime_type: string
  data: string // Base64 encoded content
}

/**
 * Complete ingestion request payload
 */
export interface IngestPayload {
  execution: ExecutionPayload
  results: TestResultPayload[]
  artifacts: ArtifactPayload[]
}

/**
 * API response from Exolar
 */
export interface IngestResponse {
  success: boolean
  execution_id?: number
  results_count?: number
  artifacts_count?: number
  error?: string
}
