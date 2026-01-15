-- Mock Webhook Actions Feature
-- Allows triggering external HTTP requests when mock endpoints are hit

-- ============================================
-- 1. Webhook Action Definitions
-- ============================================
CREATE TABLE IF NOT EXISTS mock_webhook_actions (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER NOT NULL REFERENCES mock_response_rules(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,

  -- Target configuration
  target_url TEXT NOT NULL,
  target_method VARCHAR(10) NOT NULL DEFAULT 'POST',
  target_headers JSONB DEFAULT '{}',
  target_body TEXT,  -- Supports templating: {{request.body.field}}, {{uuid}}, etc.

  -- Options
  forward_request_body BOOLEAN DEFAULT false,  -- Forward original request body as-is
  forward_request_headers BOOLEAN DEFAULT false,  -- Forward original request headers
  timeout_ms INTEGER DEFAULT 5000 CHECK (timeout_ms >= 100 AND timeout_ms <= 30000),
  retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0 AND retry_count <= 3),

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mock_webhook_actions_rule ON mock_webhook_actions(rule_id);
CREATE INDEX IF NOT EXISTS idx_mock_webhook_actions_active ON mock_webhook_actions(rule_id) WHERE is_active = true;

COMMENT ON TABLE mock_webhook_actions IS 'Webhook actions triggered when a mock rule matches';
COMMENT ON COLUMN mock_webhook_actions.target_body IS 'Response body with templating support: {{request.body.name}}, {{uuid}}, {{timestamp}}';
COMMENT ON COLUMN mock_webhook_actions.forward_request_body IS 'When true, forwards original request body to webhook URL';
COMMENT ON COLUMN mock_webhook_actions.timeout_ms IS 'Request timeout in milliseconds (100-30000, default 5000)';

-- ============================================
-- 2. Webhook Execution Logs
-- ============================================
CREATE TABLE IF NOT EXISTS mock_webhook_logs (
  id SERIAL PRIMARY KEY,
  action_id INTEGER NOT NULL REFERENCES mock_webhook_actions(id) ON DELETE CASCADE,
  request_log_id INTEGER REFERENCES mock_request_logs(id) ON DELETE SET NULL,

  -- Request sent
  request_url TEXT NOT NULL,
  request_method VARCHAR(10) NOT NULL,
  request_headers JSONB,
  request_body TEXT,

  -- Response received
  response_status INTEGER,
  response_headers JSONB,
  response_body TEXT,

  -- Execution details
  success BOOLEAN NOT NULL,
  error_message TEXT,
  duration_ms INTEGER,
  retry_attempt INTEGER DEFAULT 0,

  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mock_webhook_logs_action ON mock_webhook_logs(action_id);
CREATE INDEX IF NOT EXISTS idx_mock_webhook_logs_time ON mock_webhook_logs(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_mock_webhook_logs_request ON mock_webhook_logs(request_log_id) WHERE request_log_id IS NOT NULL;

-- Partial index for failed webhooks (useful for debugging)
CREATE INDEX IF NOT EXISTS idx_mock_webhook_logs_failed ON mock_webhook_logs(action_id, executed_at DESC) WHERE success = false;

COMMENT ON TABLE mock_webhook_logs IS 'Execution logs for webhook actions';
COMMENT ON COLUMN mock_webhook_logs.retry_attempt IS 'Retry attempt number (0 = first attempt)';

-- ============================================
-- Cleanup function for old webhook logs (keep 30 days)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_mock_webhook_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM mock_webhook_logs
  WHERE executed_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_mock_webhook_logs IS 'Cleanup old webhook logs (30 days retention)';
