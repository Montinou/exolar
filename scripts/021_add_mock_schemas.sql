-- Mock Schema Validation Feature
-- Adds JSON Schema support for request/response validation

-- ============================================
-- Add schema columns to mock_routes
-- ============================================
ALTER TABLE mock_routes
ADD COLUMN IF NOT EXISTS request_schema JSONB,
ADD COLUMN IF NOT EXISTS response_schema JSONB,
ADD COLUMN IF NOT EXISTS validate_request BOOLEAN DEFAULT false;

-- Add validation errors tracking to logs
ALTER TABLE mock_request_logs
ADD COLUMN IF NOT EXISTS validation_errors JSONB;

-- ============================================
-- Comments
-- ============================================
COMMENT ON COLUMN mock_routes.request_schema IS 'JSON Schema (Draft 2020-12) for validating incoming request bodies';
COMMENT ON COLUMN mock_routes.response_schema IS 'JSON Schema documenting expected response format';
COMMENT ON COLUMN mock_routes.validate_request IS 'When true, validates request body against request_schema and returns 400 on failure';
COMMENT ON COLUMN mock_request_logs.validation_errors IS 'Array of validation errors if request failed schema validation';
