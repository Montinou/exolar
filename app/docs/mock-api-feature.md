# Mock API Endpoints Feature

## Overview

The Mock API feature allows users to create configurable mock HTTP endpoints that return predefined responses based on request matching rules. This enables testing scenarios without real backend dependencies.

## Core Concepts

### Mock Interface
A container that groups related mock routes under a single endpoint. Each interface has:
- **Name**: Human-readable identifier
- **Slug**: URL-safe identifier (auto-generated from name)
- **Rate Limit**: Requests per minute limit (default: 100)
- **Public URL**: `https://exolar.ai-innovation.site/api/mock/{org-slug}/{interface-slug}/`

### Mock Route
A specific path/method combination within an interface:
- **Path Pattern**: Supports exact (`/users`), parameters (`/users/:id`), and wildcards (`/api/*`)
- **Method**: GET, POST, PUT, DELETE, PATCH, or `*` for any
- **Priority**: Higher priority routes are evaluated first

### Response Rule
A matching condition paired with a response configuration:
- **Matching Conditions**: Headers, query params, body JSON paths, body contains
- **Response**: Status code, headers, body, optional delay
- **Priority**: Higher priority rules are evaluated first within a route

## Database Schema

### Tables

```sql
-- Mock interfaces (containers)
CREATE TABLE mock_interfaces (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  rate_limit_rpm INTEGER DEFAULT 100,
  created_by INTEGER REFERENCES dashboard_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

-- Mock routes (path + method)
CREATE TABLE mock_routes (
  id SERIAL PRIMARY KEY,
  interface_id INTEGER NOT NULL REFERENCES mock_interfaces(id) ON DELETE CASCADE,
  path_pattern TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(interface_id, path_pattern, method)
);

-- Response rules (matching + response)
CREATE TABLE mock_response_rules (
  id SERIAL PRIMARY KEY,
  route_id INTEGER NOT NULL REFERENCES mock_routes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,

  -- Matching conditions (null = match any)
  match_headers JSONB,
  match_query JSONB,
  match_body JSONB,
  match_body_contains TEXT,

  -- Response configuration
  response_status INTEGER NOT NULL DEFAULT 200,
  response_headers JSONB DEFAULT '{"Content-Type": "application/json"}',
  response_body TEXT,
  response_delay_ms INTEGER DEFAULT 0,

  -- Metadata
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Request logs (debugging)
CREATE TABLE mock_request_logs (
  id SERIAL PRIMARY KEY,
  interface_id INTEGER NOT NULL REFERENCES mock_interfaces(id) ON DELETE CASCADE,
  route_id INTEGER REFERENCES mock_routes(id) ON DELETE SET NULL,
  rule_id INTEGER REFERENCES mock_response_rules(id) ON DELETE SET NULL,

  method TEXT NOT NULL,
  path TEXT NOT NULL,
  headers JSONB,
  query_params JSONB,
  body TEXT,

  response_status INTEGER,
  response_body TEXT,
  matched BOOLEAN DEFAULT false,

  request_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  response_time_ms INTEGER
);
```

## Request Matching

### Path Matching

| Pattern | Example | Matches |
|---------|---------|---------|
| Exact | `/users` | Only `/users` |
| Parameter | `/users/:id` | `/users/123`, `/users/abc` |
| Wildcard | `/api/*` | `/api/v1/users`, `/api/health` |

### Rule Matching

All conditions use AND logic (all must match). Supports:

**Headers:**
```json
{
  "Authorization": "Bearer *",
  "Content-Type": "application/json"
}
```
- Exact match: `"application/json"`
- Wildcard: `"*"` (any value)
- Prefix: `"Bearer *"` (starts with)

**Query Parameters:**
```json
{
  "page": "1",
  "status": "*"
}
```

**Body JSON Path:**
```json
{
  "user.email": "*@test.com",
  "order.items[0].id": "*"
}
```

**Body Contains:**
```
"error"
```

## Response Templating

Response bodies support Handlebars-style templating:

| Template | Description | Example |
|----------|-------------|---------|
| `{{request.body.name}}` | Request body field | `"Hello, John"` |
| `{{request.query.page}}` | Query parameter | `"Page 1"` |
| `{{request.headers.authorization}}` | Request header | `"Bearer xyz"` |
| `{{request.params.id}}` | URL parameter | `"User 123"` |
| `{{timestamp}}` | Current ISO timestamp | `"2025-01-14T..."` |
| `{{uuid}}` | Random UUID | `"a1b2c3..."` |

**Example:**
```json
{
  "message": "Hello, {{request.body.name}}!",
  "userId": "{{request.params.id}}",
  "timestamp": "{{timestamp}}"
}
```

## Rate Limiting

Each interface has a configurable rate limit (requests per minute):
- Default: 100 rpm
- When exceeded: Returns 429 Too Many Requests
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## API Endpoints

### Management (Authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mocks` | List all interfaces |
| POST | `/api/mocks` | Create interface |
| GET | `/api/mocks/:id` | Get interface details |
| PUT | `/api/mocks/:id` | Update interface |
| DELETE | `/api/mocks/:id` | Delete interface |
| GET | `/api/mocks/:id/routes` | List routes |
| POST | `/api/mocks/:id/routes` | Create route |
| PUT | `/api/mocks/:id/routes/:routeId` | Update route |
| DELETE | `/api/mocks/:id/routes/:routeId` | Delete route |
| GET | `/api/mocks/:id/routes/:routeId/rules` | List rules |
| POST | `/api/mocks/:id/routes/:routeId/rules` | Create rule |
| PUT | `/api/mocks/:id/routes/:routeId/rules/:ruleId` | Update rule |
| DELETE | `/api/mocks/:id/routes/:routeId/rules/:ruleId` | Delete rule |
| GET | `/api/mocks/:id/logs` | Get request logs |

### Public Mock Endpoints

```
https://exolar.ai-innovation.site/api/mock/{org-slug}/{interface-slug}/{path}
```

Supports: GET, POST, PUT, DELETE, PATCH, OPTIONS

## MCP Integration

### Datasets (query_exolar_data)

| Dataset | Filters | Description |
|---------|---------|-------------|
| `mock_interfaces` | - | List all interfaces with stats |
| `mock_routes` | `interface_id` | Routes for an interface |
| `mock_rules` | `route_id` | Rules for a route |
| `mock_logs` | `interface_id`, `limit` | Recent request logs |

### Actions (perform_exolar_action)

| Action | Parameters | Description |
|--------|------------|-------------|
| `create_mock_interface` | `name`, `slug`, `description`, `rate_limit_rpm` | Create new interface |
| `create_mock_route` | `interface_id`, `path_pattern`, `method` | Create new route |
| `create_mock_rule` | `route_id`, `name`, `response_*`, `match_*` | Create response rule |
| `update_mock_rule` | `rule_id`, `response_*`, `match_*` | Update existing rule |
| `delete_mock_interface` | `interface_id` | Delete interface and all routes |

**Example MCP Usage:**
```
// Create a mock interface
perform_exolar_action({
  action: "create_mock_interface",
  params: {
    name: "User API Mock",
    slug: "user-api",
    description: "Mock for user service"
  }
})

// Create a route
perform_exolar_action({
  action: "create_mock_route",
  params: {
    interface_id: 1,
    path_pattern: "/users/:id",
    method: "GET"
  }
})

// Create a response rule
perform_exolar_action({
  action: "create_mock_rule",
  params: {
    route_id: 1,
    name: "Success response",
    response_status: 200,
    response_body: "{\"id\": \"{{request.params.id}}\", \"name\": \"Test User\"}"
  }
})
```

## UI Pages

### Mock APIs List (`/dashboard/mocks`)
- Table of all interfaces with name, slug, stats
- Create new interface button
- Quick actions: Edit, Delete, Copy URL

### Interface Detail (`/dashboard/mocks/:id`)
- Interface info card with edit/delete
- Public URL with copy button
- Routes accordion with expandable rules
- Request logs table
- Test endpoint button

## File Structure

```
app/
├── api/
│   ├── mocks/                          # Management APIs
│   │   ├── route.ts                    # GET/POST interfaces
│   │   └── [id]/
│   │       ├── route.ts                # GET/PUT/DELETE interface
│   │       ├── routes/
│   │       │   ├── route.ts            # GET/POST routes
│   │       │   └── [routeId]/
│   │       │       ├── route.ts        # PUT/DELETE route
│   │       │       └── rules/
│   │       │           ├── route.ts    # GET/POST rules
│   │       │           └── [ruleId]/
│   │       │               └── route.ts # PUT/DELETE rule
│   │       └── logs/
│   │           └── route.ts            # GET logs
│   └── mock/                           # Public mock handler
│       └── [orgSlug]/
│           └── [interfaceSlug]/
│               └── [...path]/
│                   └── route.ts        # Handles all methods
├── dashboard/
│   └── mocks/
│       ├── page.tsx                    # List page
│       └── [id]/
│           └── page.tsx                # Detail page

components/
└── dashboard/
    └── mocks/
        ├── mock-interface-list.tsx
        ├── mock-interface-form.tsx
        ├── mock-route-card.tsx
        ├── mock-route-form.tsx
        ├── mock-rule-form.tsx
        ├── mock-request-logs.tsx
        └── key-value-editor.tsx

lib/
├── db/
│   └── mocks.ts                        # Query functions
├── mock-utils.ts                       # Matching & templating
└── types.ts                            # Type definitions
```

## Security Considerations

1. **Public Endpoints**: No authentication required - isolated by org-slug
2. **Rate Limiting**: Prevents abuse (configurable per interface)
3. **Body Size**: Max 100KB response body
4. **Request Logging**: Auto-cleanup after 7 days
5. **No Secrets**: System warns if response contains sensitive patterns

## Future Enhancements

- [ ] OpenAPI/Swagger import
- [ ] Postman collection import/export
- [ ] Response sequences (different response on each call)
- [ ] Webhook forwarding (proxy to real endpoint)
- [ ] Chaos engineering (random failures, latency injection)
- [ ] JavaScript response handlers (complex dynamic logic)
