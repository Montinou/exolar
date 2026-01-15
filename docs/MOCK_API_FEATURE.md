# Mock API Feature Documentation

## Overview

The Mock API feature allows you to create configurable HTTP endpoints that simulate real APIs for testing purposes. This is useful for:

- **E2E Testing**: Mock external services during test runs
- **Development**: Work without depending on external APIs
- **Webhook Simulation**: Receive and inspect webhook calls
- **External Triggers**: Automatically call external services when mocks are hit (like LCMS case creation)

## Architecture

```
                                    ┌─────────────────────────────────────┐
                                    │           Mock Interface            │
                                    │  (Container for related endpoints)  │
                                    └─────────────────────────────────────┘
                                                      │
                              ┌───────────────────────┼───────────────────────┐
                              │                       │                       │
                    ┌─────────▼─────────┐   ┌─────────▼─────────┐   ┌─────────▼─────────┐
                    │    Mock Route     │   │    Mock Route     │   │    Mock Route     │
                    │ POST /users       │   │ GET /users/:id    │   │ DELETE /users/:id │
                    └─────────┬─────────┘   └───────────────────┘   └───────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼─────────┐ ┌───▼───────────┐ ┌─▼─────────────────┐
    │   Response Rule   │ │ Response Rule │ │   Response Rule   │
    │ (match: any)      │ │ (error case)  │ │ (specific user)   │
    │ status: 201       │ │ status: 400   │ │ status: 200       │
    └─────────┬─────────┘ └───────────────┘ └───────────────────┘
              │
    ┌─────────▼─────────┐
    │  Webhook Action   │
    │ POST to external  │
    │ service on match  │
    └───────────────────┘
```

## Database Schema

### Tables

#### `mock_interfaces`
Container for mock endpoints. Each interface generates a unique public URL.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| organization_id | INTEGER | Organization (multi-tenant) |
| name | VARCHAR(100) | Display name |
| slug | VARCHAR(50) | URL-safe identifier |
| description | TEXT | Optional description |
| is_active | BOOLEAN | Enable/disable |
| rate_limit_rpm | INTEGER | Requests per minute (default: 100) |
| created_by | INTEGER | User who created |
| created_at | TIMESTAMPTZ | Creation timestamp |

#### `mock_routes`
Path + method definitions within an interface.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| interface_id | INTEGER | Parent interface |
| path_pattern | VARCHAR(200) | URL pattern (supports params) |
| method | VARCHAR(10) | HTTP method or `*` for any |
| description | TEXT | Optional description |
| is_active | BOOLEAN | Enable/disable |
| priority | INTEGER | Higher = evaluated first |
| request_schema | JSONB | JSON Schema for request validation |
| response_schema | JSONB | JSON Schema for documentation |
| validate_request | BOOLEAN | Enable request validation |

**Path Pattern Syntax:**
- Exact: `/users`, `/health`
- Parameters: `/users/:id`, `/orders/:orderId/items/:itemId`
- Wildcards: `/api/*`, `/proxy/*`

#### `mock_response_rules`
Matching conditions + response configuration for routes.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| route_id | INTEGER | Parent route |
| name | VARCHAR(100) | Rule name |
| match_headers | JSONB | Header matching conditions |
| match_query | JSONB | Query param matching |
| match_body | JSONB | JSON path matching |
| match_body_contains | TEXT | Substring matching |
| response_status | INTEGER | HTTP status code |
| response_headers | JSONB | Response headers |
| response_body | TEXT | Response body (supports templating) |
| response_delay_ms | INTEGER | Artificial delay (0-30000ms) |
| priority | INTEGER | Higher = evaluated first |
| is_active | BOOLEAN | Enable/disable |
| hit_count | INTEGER | Usage counter |

#### `mock_webhook_actions`
Webhook triggers that fire when a rule matches.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| rule_id | INTEGER | Parent rule |
| name | VARCHAR(100) | Action name |
| target_url | TEXT | Webhook destination URL |
| target_method | VARCHAR(10) | HTTP method (default: POST) |
| target_headers | JSONB | Headers to send |
| target_body | TEXT | Body (supports templating) |
| forward_request_body | BOOLEAN | Forward original body |
| forward_request_headers | BOOLEAN | Forward original headers |
| timeout_ms | INTEGER | Request timeout (100-30000ms) |
| retry_count | INTEGER | Retry attempts (0-3) |
| is_active | BOOLEAN | Enable/disable |

#### `mock_request_logs`
Audit trail of all requests to mock endpoints.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| interface_id | INTEGER | Target interface |
| route_id | INTEGER | Matched route (nullable) |
| rule_id | INTEGER | Matched rule (nullable) |
| method | VARCHAR(10) | HTTP method |
| path | VARCHAR(500) | Request path |
| headers | JSONB | Request headers |
| query_params | JSONB | Query parameters |
| body | TEXT | Request body |
| response_status | INTEGER | Response status |
| response_body | TEXT | Response body |
| matched | BOOLEAN | Whether a rule matched |
| validation_errors | JSONB | Schema validation errors |
| request_at | TIMESTAMPTZ | Timestamp |
| response_time_ms | INTEGER | Response time |

#### `mock_webhook_logs`
Execution logs for webhook actions.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| action_id | INTEGER | Webhook action |
| request_log_id | INTEGER | Original request (nullable) |
| request_url | TEXT | URL called |
| request_method | VARCHAR(10) | Method used |
| request_headers | JSONB | Headers sent |
| request_body | TEXT | Body sent |
| response_status | INTEGER | Response status |
| response_headers | JSONB | Response headers |
| response_body | TEXT | Response body |
| success | BOOLEAN | Success/failure |
| error_message | TEXT | Error details |
| duration_ms | INTEGER | Execution time |
| retry_attempt | INTEGER | Retry number |
| executed_at | TIMESTAMPTZ | Timestamp |

## Setup

### 1. Run Migrations

Execute the SQL migration files in order:

```bash
# From project root
psql $DATABASE_URL -f scripts/020_add_mock_endpoints.sql
psql $DATABASE_URL -f scripts/021_add_mock_schemas.sql
psql $DATABASE_URL -f scripts/022_add_mock_webhooks.sql
```

### 2. Install Dependencies

```bash
pnpm add ajv ajv-formats
```

## API Endpoints

### Management API (Authenticated)

#### Interfaces
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mocks` | List all interfaces |
| POST | `/api/mocks` | Create interface |
| GET | `/api/mocks/[id]` | Get interface details |
| PUT | `/api/mocks/[id]` | Update interface |
| DELETE | `/api/mocks/[id]` | Delete interface |

#### Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mocks/[id]/routes` | List routes |
| POST | `/api/mocks/[id]/routes` | Create route |
| GET | `/api/mocks/[id]/routes/[routeId]` | Get route with rules |
| PUT | `/api/mocks/[id]/routes/[routeId]` | Update route |
| DELETE | `/api/mocks/[id]/routes/[routeId]` | Delete route |

#### Rules
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mocks/[id]/routes/[routeId]/rules` | List rules |
| POST | `/api/mocks/[id]/routes/[routeId]/rules` | Create rule |
| PUT | `/api/mocks/[id]/routes/[routeId]/rules/[ruleId]` | Update rule |
| DELETE | `/api/mocks/[id]/routes/[routeId]/rules/[ruleId]` | Delete rule |

#### Logs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mocks/[id]/logs` | Get request logs |

### Public Mock Handler (Unauthenticated)

```
GET|POST|PUT|DELETE|PATCH /api/mock/[orgSlug]/[interfaceSlug]/[...path]
```

Example: `POST https://exolar.ai-innovation.site/api/mock/my-org/user-api/users`

### Public Logs Endpoint (Unauthenticated)

Access mock request logs without authentication - optimized for E2E test validation.

```
GET /api/mock/[orgSlug]/[interfaceSlug]/logs
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `since` | ISO8601 | Last 5 minutes | Only logs after this timestamp |
| `limit` | number | 50 | Max entries (1-500) |
| `path` | string | - | Filter by path (partial match) |
| `method` | string | - | Filter by HTTP method (GET, POST, etc.) |

**Example Request:**
```bash
curl "https://exolar.ai-innovation.site/api/mock/attorneyshare/leaddocket-lcms/logs?since=2024-01-15T10:00:00Z&limit=10&path=/webhook&method=POST"
```

**Response Format:**
```json
{
  "interface": {
    "name": "LeadDocket LCMS",
    "slug": "leaddocket-lcms"
  },
  "logs": [
    {
      "id": 123,
      "method": "POST",
      "path": "/leaddocket/v1/add-note/99999",
      "headers": {...},
      "query_params": {},
      "body": "{\"note_text\":\"...\"}",
      "response_status": 200,
      "response_body": "{\"success\":true}",
      "matched": true,
      "request_at": "2024-01-15T10:05:00.258Z",
      "response_time_ms": 43
    }
  ],
  "count": 1
}
```

**E2E Test Usage Pattern:**
```typescript
import { test, expect } from '@playwright/test'

test('webhook is called during negotiation', async ({ page }) => {
  // Capture start time before test actions
  const testStartTime = new Date().toISOString()

  // ... perform test actions that trigger webhooks ...
  await page.click('[data-testid="send-proposal"]')
  await page.waitForTimeout(1000) // Allow webhook to fire

  // Fetch only logs from this test run
  const response = await fetch(
    `https://exolar.ai-innovation.site/api/mock/attorneyshare/leaddocket-lcms/logs?since=${testStartTime}&path=/add-note`
  )
  const { logs, count } = await response.json()

  // Verify webhook was called with correct data
  expect(count).toBeGreaterThan(0)
  expect(logs[0].response_status).toBe(200)
  expect(logs[0].body).toContain('proposal')
})
```

**Security Notes:**
- No authentication required (public by design)
- Access requires knowing both org slug and interface slug
- Default `since` of 5 minutes prevents fetching entire history
- Maximum limit of 500 prevents large data dumps
- Logs auto-cleanup after 7 days

## Features

### 1. Response Templating

Response bodies support dynamic values using `{{...}}` syntax:

| Template | Description | Example Output |
|----------|-------------|----------------|
| `{{uuid}}` | Random UUID | `550e8400-e29b-41d4-a716-446655440000` |
| `{{timestamp}}` | ISO timestamp | `2024-01-15T10:30:00.000Z` |
| `{{random.number}}` | Random 1-1000 | `42` |
| `{{random.string}}` | Random 8-char | `a8f3b2c1` |
| `{{request.body.field}}` | Request body value | Value of `field` |
| `{{request.query.param}}` | Query param | Value of `param` |
| `{{request.headers.name}}` | Header value | Value of `name` |
| `{{request.params.id}}` | Path param | Value of `:id` |

**Example:**
```json
{
  "id": "{{uuid}}",
  "name": "{{request.body.name}}",
  "createdAt": "{{timestamp}}",
  "requestedBy": "{{request.headers.x-user-id}}"
}
```

### 2. Request Matching

Rules are matched in priority order. All conditions must match (AND logic).

#### Header Matching
```json
{
  "Authorization": "Bearer *",
  "Content-Type": "application/json",
  "X-Custom": "/^prefix-.*/i"
}
```

Patterns:
- Exact: `"value"`
- Wildcard: `"*"`, `"Bearer *"`, `"*@example.com"`
- Regex: `"/pattern/flags"`

#### Query Matching
```json
{
  "page": "1",
  "status": "*"
}
```

#### Body Matching (JSON Paths)
```json
{
  "user.email": "*@test.com",
  "items[0].quantity": "*"
}
```

#### Body Contains
Simple substring match:
```
"error"
```

### 3. JSON Schema Validation

Routes can validate incoming requests against JSON Schema:

```json
{
  "path_pattern": "/users",
  "method": "POST",
  "validate_request": true,
  "request_schema": {
    "type": "object",
    "required": ["name", "email"],
    "properties": {
      "name": { "type": "string", "minLength": 1 },
      "email": { "type": "string", "format": "email" },
      "age": { "type": "integer", "minimum": 0 }
    }
  },
  "response_schema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "name": { "type": "string" },
      "email": { "type": "string" }
    }
  }
}
```

When `validate_request` is true and a request fails validation:
- Returns `400 Bad Request`
- Response includes `validation_errors` array
- Logged with validation errors for debugging

### 4. Webhook Actions

Configure webhooks to trigger external HTTP requests when a rule matches:

```json
{
  "name": "Notify LCMS",
  "target_url": "https://lcms.example.com/api/cases",
  "target_method": "POST",
  "target_headers": {
    "Authorization": "Bearer secret-token",
    "Content-Type": "application/json"
  },
  "target_body": "{\"caseId\": \"{{request.body.id}}\", \"source\": \"mock\"}",
  "forward_request_body": false,
  "forward_request_headers": false,
  "timeout_ms": 5000,
  "retry_count": 2
}
```

**Features:**
- Async execution (doesn't block mock response)
- Templating support in URL and body
- Forward original request body/headers
- Configurable timeout (100-30000ms)
- Automatic retries with exponential backoff
- Execution logging

### 5. Rate Limiting

Per-interface rate limiting with sliding window:

- Default: 100 requests/minute
- Configurable per interface
- Returns `429 Too Many Requests` when exceeded
- Includes rate limit headers:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

### 6. Request Logging

All requests are logged with:
- Full request details (method, path, headers, body)
- Matched route/rule information
- Response details
- Timing information
- Validation errors (if any)

Logs are retained for 7 days (configurable via `cleanup_mock_request_logs()` function).

## Usage Examples

### Example 1: Simple User API Mock

1. **Create Interface**
```bash
curl -X POST https://exolar.ai-innovation.site/api/mocks \
  -H "Content-Type: application/json" \
  -d '{"name": "User API", "slug": "user-api"}'
```

2. **Create Route**
```bash
curl -X POST https://exolar.ai-innovation.site/api/mocks/1/routes \
  -H "Content-Type: application/json" \
  -d '{"path_pattern": "/users/:id", "method": "GET"}'
```

3. **Create Response Rule**
```bash
curl -X POST https://exolar.ai-innovation.site/api/mocks/1/routes/1/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Success Response",
    "response_status": 200,
    "response_body": "{\"id\": \"{{request.params.id}}\", \"name\": \"Test User\"}"
  }'
```

4. **Test the Mock**
```bash
curl https://exolar.ai-innovation.site/api/mock/my-org/user-api/users/123
# Response: {"id": "123", "name": "Test User"}
```

### Example 2: Webhook Integration (LCMS-style)

1. **Create Route for Case Creation**
```json
{
  "path_pattern": "/cases",
  "method": "POST",
  "validate_request": true,
  "request_schema": {
    "type": "object",
    "required": ["title", "description"],
    "properties": {
      "title": { "type": "string" },
      "description": { "type": "string" }
    }
  }
}
```

2. **Create Response Rule**
```json
{
  "name": "Create Case Success",
  "response_status": 201,
  "response_body": "{\"id\": \"{{uuid}}\", \"title\": \"{{request.body.title}}\", \"status\": \"created\"}"
}
```

3. **Add Webhook Action**
```json
{
  "name": "Sync to External System",
  "target_url": "https://external-system.com/api/cases",
  "target_method": "POST",
  "target_headers": {
    "Authorization": "Bearer external-api-key"
  },
  "forward_request_body": true,
  "timeout_ms": 10000,
  "retry_count": 3
}
```

Now when you POST to `/api/mock/org/interface/cases`:
1. Request is validated against schema
2. Mock returns success response immediately
3. Webhook fires asynchronously to external system
4. Webhook execution is logged for debugging

## UI Components

### Test Endpoint Modal

The `TestEndpointModal` component allows testing mock endpoints directly from the dashboard:

```tsx
import { TestEndpointModal } from "@/components/dashboard/mocks/test-endpoint-modal"

<TestEndpointModal
  open={isOpen}
  onOpenChange={setIsOpen}
  baseUrl="https://exolar.ai-innovation.site/api/mock/org/interface"
  routes={[
    { path_pattern: "/users", method: "GET" },
    { path_pattern: "/users/:id", method: "GET" },
    { path_pattern: "/users", method: "POST" }
  ]}
/>
```

**Features:**
- HTTP method selector (GET, POST, PUT, DELETE, PATCH)
- Path input with route hints (click to autofill)
- Headers JSON editor
- Body JSON editor (for POST/PUT/PATCH)
- Response display with status, headers, body, and timing

### Enhanced Log Viewer

The `MockLogsViewer` component provides advanced request log inspection:

```tsx
import { MockLogsViewer } from "@/components/dashboard/mocks/mock-logs-viewer"

<MockLogsViewer
  interfaceId={1}
  interfaceName="user-api"
/>
```

**Features:**
- **Statistics Dashboard**: Total requests, matched/unmatched counts, status distribution
- **Advanced Filters**:
  - Path search (partial match)
  - HTTP method filter
  - Status code filter (All/2xx/3xx/4xx/5xx)
  - Matched/Unmatched toggle
  - Date range picker (from/to)
- **Pagination**: Configurable page sizes (25, 50, 100, 250)
- **Expandable Rows**: Click any log to see full details:
  - Request headers, query params, body
  - Response body
  - Validation errors (if any)
  - Route/Rule IDs
- **Export**: Download logs as JSON or CSV

### Log API Endpoints

```bash
# Get filtered logs
GET /api/mocks/{id}/logs?path=/users&status=4xx&matched=false&from=2024-01-01&limit=100

# Get log statistics
POST /api/mocks/{id}/logs
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| path | string | Filter by path (partial match) |
| method | string | Filter by HTTP method |
| status | string | Status filter (2xx, 3xx, 4xx, 5xx, or specific code) |
| matched | boolean | Filter by matched status |
| from | ISO date | Start date filter |
| to | ISO date | End date filter |
| limit | number | Results per page (1-1000, default 100) |
| offset | number | Pagination offset |

## MCP Integration

The Mock API feature is integrated with MCP for Claude Code access:

### Available Actions

```typescript
// Create interface
perform_exolar_action({
  action: "create_mock_interface",
  params: { name: "User API", slug: "user-api" }
})

// Create route
perform_exolar_action({
  action: "create_mock_route",
  params: { interface_id: 1, path_pattern: "/users/:id", method: "GET" }
})

// Create rule
perform_exolar_action({
  action: "create_mock_rule",
  params: {
    route_id: 1,
    name: "Success",
    response_status: 200,
    response_body: '{"id": "{{request.params.id}}"}'
  }
})

// Delete interface
perform_exolar_action({
  action: "delete_mock_interface",
  params: { interface_id: 1 }
})
```

### Available Datasets

```typescript
// List interfaces
query_exolar_data({ dataset: "mock_interfaces" })

// List routes for interface
query_exolar_data({ dataset: "mock_routes", filters: { interface_id: 1 } })

// List rules for route
query_exolar_data({ dataset: "mock_rules", filters: { route_id: 1 } })

// Get request logs
query_exolar_data({ dataset: "mock_logs", filters: { interface_id: 1, limit: 50 } })
```

## File Structure

```
lib/
├── db/
│   └── mocks.ts              # Database CRUD operations
├── services/
│   └── mock-webhook-service.ts  # Webhook execution
├── mock-utils.ts             # Path matching, templating
├── mock-schema-validator.ts  # JSON Schema validation
└── types.ts                  # TypeScript types

app/
├── api/
│   ├── mocks/                # Management API
│   │   ├── route.ts          # List/create interfaces
│   │   └── [id]/
│   │       ├── route.ts      # Get/update/delete interface
│   │       ├── routes/       # Route management
│   │       │   └── [routeId]/
│   │       │       └── rules/  # Rule management
│   │       └── logs/         # Request logs
│   └── mock/                 # Public handler
│       └── [orgSlug]/[interfaceSlug]/[...path]/
│           └── route.ts      # Handle mock requests
└── dashboard/
    └── mocks/
        ├── page.tsx          # List interfaces
        └── [id]/
            └── page.tsx      # Interface details

components/
└── dashboard/
    └── mocks/
        ├── test-endpoint-modal.tsx  # Test endpoint UI
        └── mock-logs-viewer.tsx     # Enhanced log viewer

scripts/
├── 020_add_mock_endpoints.sql   # Core tables
├── 021_add_mock_schemas.sql     # Schema validation
└── 022_add_mock_webhooks.sql    # Webhook tables
```

## Troubleshooting

### "Mock API tables not initialized"

Run the migration scripts:
```bash
psql $DATABASE_URL -f scripts/020_add_mock_endpoints.sql
```

### Webhooks not firing

1. Check if `is_active` is true for the webhook action
2. Check webhook logs in `mock_webhook_logs` table
3. Verify target URL is accessible
4. Check timeout settings (default 5s)

### Schema validation not working

1. Ensure `validate_request` is true on the route
2. Verify `request_schema` is valid JSON Schema
3. Check request logs for `validation_errors`

### Rate limiting too aggressive

Increase `rate_limit_rpm` on the interface (default: 100):
```bash
curl -X PUT https://exolar.ai-innovation.site/api/mocks/1 \
  -H "Content-Type: application/json" \
  -d '{"rate_limit_rpm": 1000}'
```

## Security Considerations

- Mock endpoints are public (no authentication required)
- Rate limiting prevents abuse
- Webhook secrets should use environment variables
- Request/response bodies are logged (avoid sensitive data in test)
- Organization isolation via multi-tenancy
