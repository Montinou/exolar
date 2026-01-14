-- Mock API Endpoints Feature
-- Allows users to create configurable mock HTTP endpoints with response rules

-- ============================================
-- 1. Mock Interfaces (containers for mock endpoints)
-- ============================================
CREATE TABLE IF NOT EXISTS mock_interfaces (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  rate_limit_rpm INTEGER DEFAULT 100,  -- Requests per minute limit
  created_by INTEGER REFERENCES dashboard_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

-- Indexes for mock_interfaces
CREATE INDEX IF NOT EXISTS idx_mock_interfaces_org ON mock_interfaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_mock_interfaces_slug ON mock_interfaces(organization_id, slug);
CREATE INDEX IF NOT EXISTS idx_mock_interfaces_active ON mock_interfaces(organization_id)
  WHERE is_active = true;

COMMENT ON TABLE mock_interfaces IS 'Mock API interface containers, each generates a public URL';
COMMENT ON COLUMN mock_interfaces.slug IS 'URL-safe identifier, unique per organization';
COMMENT ON COLUMN mock_interfaces.rate_limit_rpm IS 'Rate limit in requests per minute (default: 100)';

-- ============================================
-- 2. Mock Routes (path + method definitions)
-- ============================================
CREATE TABLE IF NOT EXISTS mock_routes (
  id SERIAL PRIMARY KEY,
  interface_id INTEGER NOT NULL REFERENCES mock_interfaces(id) ON DELETE CASCADE,
  path_pattern VARCHAR(200) NOT NULL,  -- e.g., "/users/:id", "/health", "/api/*"
  method VARCHAR(10) NOT NULL DEFAULT 'GET',  -- GET, POST, PUT, DELETE, PATCH, *
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,  -- Higher = evaluated first
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(interface_id, path_pattern, method)
);

-- Indexes for mock_routes
CREATE INDEX IF NOT EXISTS idx_mock_routes_interface ON mock_routes(interface_id);
CREATE INDEX IF NOT EXISTS idx_mock_routes_priority ON mock_routes(interface_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_mock_routes_active ON mock_routes(interface_id)
  WHERE is_active = true;

COMMENT ON TABLE mock_routes IS 'Routes within a mock interface, matched by path pattern and method';
COMMENT ON COLUMN mock_routes.path_pattern IS 'Path pattern: exact (/users), params (/users/:id), wildcard (/api/*)';
COMMENT ON COLUMN mock_routes.method IS 'HTTP method or * for any method';
COMMENT ON COLUMN mock_routes.priority IS 'Higher priority routes are evaluated first';

-- ============================================
-- 3. Mock Response Rules (matching conditions + responses)
-- ============================================
CREATE TABLE IF NOT EXISTS mock_response_rules (
  id SERIAL PRIMARY KEY,
  route_id INTEGER NOT NULL REFERENCES mock_routes(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,

  -- Matching conditions (null = match any)
  match_headers JSONB,           -- {"Authorization": "Bearer *", "Content-Type": "application/json"}
  match_query JSONB,             -- {"page": "1", "status": "*"}
  match_body JSONB,              -- JSON path matching {"user.email": "*@test.com"}
  match_body_contains TEXT,      -- Simple substring match in body

  -- Response configuration
  response_status INTEGER NOT NULL DEFAULT 200,
  response_headers JSONB DEFAULT '{"Content-Type": "application/json"}',
  response_body TEXT,            -- Supports templating: {{request.body.name}}, {{uuid}}
  response_delay_ms INTEGER DEFAULT 0,  -- Simulate latency (max 30s)

  -- Metadata
  priority INTEGER DEFAULT 0,    -- Higher = evaluated first
  is_active BOOLEAN DEFAULT true,
  hit_count INTEGER DEFAULT 0,   -- Track usage
  last_hit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for mock_response_rules
CREATE INDEX IF NOT EXISTS idx_mock_response_rules_route ON mock_response_rules(route_id);
CREATE INDEX IF NOT EXISTS idx_mock_response_rules_priority ON mock_response_rules(route_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_mock_response_rules_active ON mock_response_rules(route_id)
  WHERE is_active = true;

COMMENT ON TABLE mock_response_rules IS 'Response rules with matching conditions and response configuration';
COMMENT ON COLUMN mock_response_rules.match_headers IS 'Header matching: exact, wildcard (*), or prefix (Bearer *)';
COMMENT ON COLUMN mock_response_rules.match_query IS 'Query param matching: exact or wildcard';
COMMENT ON COLUMN mock_response_rules.match_body IS 'JSON path matching for request body';
COMMENT ON COLUMN mock_response_rules.response_body IS 'Response body with templating support: {{request.body.name}}, {{uuid}}, {{timestamp}}';
COMMENT ON COLUMN mock_response_rules.response_delay_ms IS 'Artificial delay in milliseconds (max 30000)';

-- ============================================
-- 4. Mock Request Logs (for debugging)
-- ============================================
CREATE TABLE IF NOT EXISTS mock_request_logs (
  id SERIAL PRIMARY KEY,
  interface_id INTEGER NOT NULL REFERENCES mock_interfaces(id) ON DELETE CASCADE,
  route_id INTEGER REFERENCES mock_routes(id) ON DELETE SET NULL,
  rule_id INTEGER REFERENCES mock_response_rules(id) ON DELETE SET NULL,

  -- Request details
  method VARCHAR(10) NOT NULL,
  path VARCHAR(500) NOT NULL,
  headers JSONB,
  query_params JSONB,
  body TEXT,

  -- Response details
  response_status INTEGER,
  response_body TEXT,
  matched BOOLEAN DEFAULT false,

  -- Timing
  request_at TIMESTAMPTZ DEFAULT NOW(),
  response_time_ms INTEGER
);

-- Indexes for mock_request_logs
CREATE INDEX IF NOT EXISTS idx_mock_request_logs_interface ON mock_request_logs(interface_id);
CREATE INDEX IF NOT EXISTS idx_mock_request_logs_time ON mock_request_logs(request_at DESC);
CREATE INDEX IF NOT EXISTS idx_mock_request_logs_interface_time ON mock_request_logs(interface_id, request_at DESC);

-- Partial index for unmatched requests (for debugging)
CREATE INDEX IF NOT EXISTS idx_mock_request_logs_unmatched ON mock_request_logs(interface_id, request_at DESC)
  WHERE matched = false;

COMMENT ON TABLE mock_request_logs IS 'Request logs for debugging mock endpoints';
COMMENT ON COLUMN mock_request_logs.matched IS 'Whether a matching route/rule was found';
COMMENT ON COLUMN mock_request_logs.response_time_ms IS 'Total response time including artificial delays';

-- ============================================
-- 5. Rate Limiting Table (sliding window)
-- ============================================
CREATE TABLE IF NOT EXISTS mock_rate_limit_hits (
  id SERIAL PRIMARY KEY,
  interface_id INTEGER NOT NULL REFERENCES mock_interfaces(id) ON DELETE CASCADE,
  hit_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for counting recent hits
CREATE INDEX IF NOT EXISTS idx_mock_rate_limit_hits_interface ON mock_rate_limit_hits(interface_id, hit_at DESC);

-- Auto-cleanup old hits (keep only last hour for counting)
-- This can be run periodically via cron or cleaned up during rate limit checks

COMMENT ON TABLE mock_rate_limit_hits IS 'Rate limiting tracking table for sliding window counts';

-- ============================================
-- Cleanup function for old request logs (keep 7 days)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_mock_request_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM mock_request_logs
  WHERE request_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Also cleanup old rate limit hits (keep 1 hour)
  DELETE FROM mock_rate_limit_hits
  WHERE hit_at < NOW() - INTERVAL '1 hour';

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_mock_request_logs IS 'Cleanup old request logs (7 days) and rate limit hits (1 hour)';
