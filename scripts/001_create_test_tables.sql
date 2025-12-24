-- Create schema for E2E test results
CREATE TABLE IF NOT EXISTS test_executions (
  id SERIAL PRIMARY KEY,
  run_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  commit_message TEXT,
  triggered_by TEXT NOT NULL,
  workflow_name TEXT DEFAULT 'E2E Tests',
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'running')),
  total_tests INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_results (
  id SERIAL PRIMARY KEY,
  execution_id INTEGER NOT NULL REFERENCES test_executions(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  test_file TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'skipped', 'timedout')),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  is_critical BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  stack_trace TEXT,
  browser TEXT DEFAULT 'chromium',
  retry_count INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_artifacts (
  id SERIAL PRIMARY KEY,
  test_result_id INTEGER NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('video', 'trace', 'screenshot')),
  r2_key TEXT NOT NULL,
  r2_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_test_executions_status ON test_executions(status);
CREATE INDEX IF NOT EXISTS idx_test_executions_started_at ON test_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_executions_branch ON test_executions(branch);
CREATE INDEX IF NOT EXISTS idx_test_results_execution_id ON test_results(execution_id);
CREATE INDEX IF NOT EXISTS idx_test_results_status ON test_results(status);
CREATE INDEX IF NOT EXISTS idx_test_results_is_critical ON test_results(is_critical) WHERE is_critical = true;
CREATE INDEX IF NOT EXISTS idx_test_artifacts_test_result_id ON test_artifacts(test_result_id);
