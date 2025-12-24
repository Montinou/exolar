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
  status: "passed" | "failed" | "skipped" | "timedout"
  duration_ms: number
  is_critical: boolean
  error_message: string | null
  stack_trace: string | null
  browser: string
  retry_count: number
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
