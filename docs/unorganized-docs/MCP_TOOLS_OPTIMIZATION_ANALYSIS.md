# MCP Tools Optimization Analysis

A comprehensive analysis of the 20 MCP tools in the Exolar QA Dashboard, with identified optimizations and improvement opportunities.

---

## Overview

| Category | Tools | Status |
|----------|-------|--------|
| Core | 4 | ✅ Well implemented |
| Analysis | 4 | ⚠️ Minor optimizations possible |
| Flakiness | 2 | ⚠️ Enhancement opportunities |
| Aggregation | 3 | ✅ Good design |
| Performance | 3 | ⚠️ Improvements possible |
| Metadata | 2 | ⚠️ Missing functionality |
| Installation & Auto-Triage | 2 | ✅ Good implementation |

---

## 🔴 High Priority Optimizations

### 1. ~~`get_execution_details` - Double Database Query~~ ✅ COMPLETED

> **Implemented:** 2026-01-05 | **PR:** N/A (direct commit)

**File:** [tools.ts](file:///Users/agustinmontoya/Attorneyshare/e2e-test-dashboard/lib/mcp/tools.ts#L583-L623)

**Issue:** The function was making two separate queries for test results when filtering by status.

**Applied Fix:**
```typescript
// Single database call - store reference before any filtering
const allResults = await db.getTestResultsByExecutionId(orgId, input.execution_id)

// Filter by status if specified (in-memory filtering)
const filteredResults = input.status === "all"
  ? allResults
  : allResults.filter((r) => r.status === input.status)
```

**Result:** Eliminated 1 redundant database query per call (~50% reduction in DB calls for this endpoint).

---

### 2. ~~Missing Pagination in Multiple Tools~~ ✅ COMPLETED

> **Implemented:** 2026-01-05 | **PR:** N/A (direct commit)

**Affected Tools (all now have pagination):**
- `get_executions` ✅
- `search_tests` ✅
- `get_test_history` ✅
- `get_failed_tests` ✅

**Applied Enhancement:**
```typescript
// New parameter added to all tools
offset: { type: "number", default: 0, description: "Skip N results for pagination" }

// Response now includes pagination metadata
{
  pagination: {
    offset: 0,
    limit: 20,
    has_more: true  // true if results.length === limit
  },
  results: [...]
}
```

**Result:** Enables efficient page-by-page navigation of large datasets. Cursor-based pagination deferred to future enhancement.

---

### 3. `get_error_distribution` - Missing Grouping Options

**File:** [tools.ts](file:///Users/agustinmontoya/Attorneyshare/e2e-test-dashboard/lib/mcp/tools.ts#L193-L208)

**Current Parameters:**
```typescript
properties: {
  since: { type: "string", description: "Only count errors since this date (ISO 8601)" },
}
```

**Missing Useful Filters:**
```typescript
properties: {
  since: { type: "string", description: "Only count errors since this date (ISO 8601)" },
  branch: { type: "string", description: "Filter by branch name" },
  suite: { type: "string", description: "Filter by test suite" },
  limit: { type: "number", default: 10, description: "Top N error types" },
  group_by: { 
    type: "string", 
    enum: ["error_type", "file", "branch"],
    description: "How to group errors"
  }
}
```

---

### 4. Auth Token Refresh Not Handled Gracefully

**File:** [auth.ts](file:///Users/agustinmontoya/Attorneyshare/e2e-test-dashboard/lib/mcp/auth.ts#L67-L112)

**Issue:** When an MCP token is close to expiration, there's no warning returned to the client.

**Enhancement:**
```typescript
export interface MCPAuthContext {
  userId: number
  email: string
  organizationId: number
  organizationSlug: string
  orgRole: "owner" | "admin" | "viewer"
  userRole: "admin" | "viewer"
  // NEW: Token status info
  tokenExpiresAt?: Date
  tokenRefreshRequired?: boolean  // true if < 3 days remaining
}
```

Then in tool responses:
```typescript
if (authContext.tokenRefreshRequired) {
  return jsonResponse({
    ...data,
    _meta: { 
      warning: "Token expires soon. Run 'npx @exolar-qa/mcp-server --login' to refresh." 
    }
  })
}
```

---

## 🟡 Medium Priority Improvements

### 5. `list_branches` / `list_suites` - Missing Statistics

**Current Response:**
```json
{
  "branch": "main",
  "last_run": "2025-01-05T00:00:00Z",
  "execution_count": 10
}
```

**Enhanced Response:**
```json
{
  "branch": "main",
  "last_run": "2025-01-05T00:00:00Z",
  "execution_count": 10,
  "pass_rate": 85.5,          // NEW: Average pass rate
  "last_status": "success",   // NEW: Last execution status
  "active_contributors": 3    // NEW: Unique commit authors
}
```

---

### 6. `get_trends` - Fixed Day Intervals Only

**Current:** Only supports `days` parameter (1-90).

**Enhancement:** Support flexible time granularity:
```typescript
properties: {
  period: {
    type: "string",
    enum: ["hour", "day", "week", "month"],
    default: "day"
  },
  count: { type: "number", default: 7, description: "Number of periods" },
  // OR date range
  from: { type: "string", description: "Start date (ISO 8601)" },
  to: { type: "string", description: "End date (ISO 8601)" }
}
```

---

### 7. `compare_executions` - Missing Performance Insights

**Current:** Returns status comparisons (new_failure, fixed, etc.).

**Missing:** Duration comparison per test.

**Enhancement:**
```typescript
tests: [
  {
    testName: "...",
    diffCategory: "unchanged",
    // NEW fields:
    baselineDuration: 1200,
    currentDuration: 1800,
    durationChange: "+50%",
    durationCategory: "regression" | "improvement" | "stable"
  }
]
```

---

### 8. `get_flaky_tests` - Missing Time Window Filter

**Current Parameters:**
```typescript
limit: { type: "number", default: 10 },
min_runs: { type: "number", default: 5 }
```

**Enhancement:**
```typescript
limit: { type: "number", default: 10 },
min_runs: { type: "number", default: 5 },
since: { type: "string", description: "Only consider runs since (ISO 8601)" },
branch: { type: "string", description: "Filter by branch" },
include_resolved: { type: "boolean", default: false, description: "Include tests that are no longer flaky" }
```

---

### 9. `classify_failure` - Confidence Thresholds

**Current:** Returns confidence as 0.0-1.0 but doesn't explain thresholds.

**Enhancement:** Add guidance in response:
```typescript
{
  suggested_classification: "FLAKE",
  confidence: 0.72,
  confidence_level: "medium",  // NEW: high (>0.8), medium (0.6-0.8), low (<0.6)
  actionable: true,            // NEW: Confidence high enough to auto-label
  recommended_action: "Add @flaky tag and investigate root cause"  // NEW
}
```

---

## 🟢 Low Priority Enhancements

### 10. Batch Operations Support

**New Tool Suggestion: `batch_classify_failures`**

Classify multiple failures in one call:
```typescript
{
  name: "batch_classify_failures",
  description: "Classify multiple failures at once. More efficient than multiple classify_failure calls.",
  inputSchema: {
    properties: {
      execution_id: { type: "number", description: "Classify all failures in an execution" },
      test_ids: { type: "array", items: { type: "number" }, description: "Specific test IDs" },
      limit: { type: "number", default: 20 }
    }
  }
}
```

---

### 11. `get_reliability_score` - Add Score History

**Current:** Returns current score only.

**Enhancement:** Return score trend:
```typescript
{
  score: 85,
  status: "healthy",
  // NEW:
  history: [
    { date: "2025-01-04", score: 82 },
    { date: "2025-01-03", score: 78 },
    { date: "2025-01-02", score: 85 }
  ],
  trend: "improving"  // improving | stable | declining
}
```

---

### 12. `generate_failure_report` - Multiple Output Formats

**Current:** Only markdown output.

**Enhancement:**
```typescript
format: {
  type: "string",
  enum: ["markdown", "json", "slack", "github_issue"],
  default: "markdown"
}
```

Each format optimized for its target:
- **slack**: Compact with emojis, links to dashboard
- **github_issue**: Template with labels and assignees suggestion

---

### 13. Tool Response Compression

**Issue:** All responses use `JSON.stringify(data, null, 2)` with pretty-printing.

**Optimization:** For large responses, use compact JSON:
```typescript
function jsonResponse(data: unknown, compact = false): ToolResponse {
  return {
    content: [{ 
      type: "text", 
      text: compact ? JSON.stringify(data) : JSON.stringify(data, null, 2) 
    }],
  }
}
```

Apply to `get_execution_details`, `get_execution_failures`, etc.

---

### 14. Missing `get_artifact_url` Tool

**Current:** Artifacts are returned as raw paths; signed URL generation happens separately.

**New Tool:**
```typescript
{
  name: "get_artifact_url",
  description: "Get a signed URL for downloading an artifact (screenshot, trace, video).",
  inputSchema: {
    properties: {
      artifact_id: { type: "number", description: "Artifact ID from test result" },
      test_id: { type: "number", description: "Test result ID" },
      artifact_type: { type: "string", enum: ["trace", "screenshot", "video"] }
    }
  }
}
```

---

### 15. Webhook/Subscription Tool

**New Tool Concept: `subscribe_to_failures`**

Enable real-time notifications:
```typescript
{
  name: "subscribe_to_failures",
  description: "Set up a webhook to be notified when new failures occur.",
  inputSchema: {
    properties: {
      webhook_url: { type: "string" },
      filters: {
        type: "object",
        properties: {
          branch: { type: "string" },
          suite: { type: "string" },
          min_failures: { type: "number", default: 1 }
        }
      }
    }
  }
}
```

---

## Code Quality Improvements

### 16. Zod Schema Reuse

**Issue:** Input validation schemas are defined inline in `handleToolCall`, duplicating the schemas in `allTools`.

**Recommendation:** Extract shared schemas:
```typescript
// schemas.ts
export const dateRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
})

export const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
})

export const branchSuiteFilterSchema = z.object({
  branch: z.string().optional(),
  suite: z.string().optional(),
})
```

---

### 17. Error Message Consistency

**Current:** Some errors are strings, some are objects.
```typescript
return errorResponse("Execution not found or access denied")
return errorResponse(`Unknown tool: ${name}`)
```

**Recommendation:** Structured error responses:
```typescript
interface MCPError {
  code: string        // e.g., "NOT_FOUND", "UNAUTHORIZED", "VALIDATION_ERROR"
  message: string
  details?: unknown
}

function errorResponse(code: string, message: string, details?: unknown): ToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: { code, message, details } }) }],
    isError: true,
  }
}
```

---

### 18. JWKS Caching with TTL

**File:** [auth.ts](file:///Users/agustinmontoya/Attorneyshare/e2e-test-dashboard/lib/mcp/auth.ts#L28-L35)

**Current:** JWKS is cached indefinitely once fetched.
```typescript
let jwks: jose.JWTVerifyGetKey | null = null
```

**Recommendation:** Add TTL to handle key rotation:
```typescript
let jwksCache: { keys: jose.JWTVerifyGetKey; fetchedAt: number } | null = null
const JWKS_TTL = 3600 * 1000 // 1 hour

async function getJWKS(): Promise<jose.JWTVerifyGetKey> {
  const now = Date.now()
  if (jwksCache && (now - jwksCache.fetchedAt) < JWKS_TTL) {
    return jwksCache.keys
  }
  const keys = jose.createRemoteJWKSet(new URL(NEON_AUTH_JWKS_URL))
  jwksCache = { keys, fetchedAt: now }
  return keys
}
```

---

## Performance Optimizations Summary

| Optimization | Impact | Effort | Status |
|-------------|--------|--------|--------|
| Fix double query in `get_execution_details` | High | Low | ✅ Done |
| Add pagination support | High | Medium | ✅ Done |
| Add filters to `get_error_distribution` | Medium | Low | 🟡 Soon |
| Token expiry warnings | Medium | Low | 🟡 Soon |
| Response compression for large payloads | Medium | Low | 🟡 Soon |
| Batch classification tool | Medium | Medium | 🟢 Later |
| Artifact signed URL tool | Low | Low | 🟢 Later |
| Webhook subscriptions | High | High | 🟢 Later |

---

## Missing Tools Summary

| Tool Name | Purpose | Priority |
|-----------|---------|----------|
| `get_artifact_url` | Generate signed URLs for artifacts | Medium |
| `batch_classify_failures` | Bulk failure classification | Medium |
| `subscribe_to_failures` | Webhook notifications | Low |
| `get_test_impact` | Show which code changes affect which tests | Low |
| `get_related_failures` | Find failures with similar error patterns | Medium |

---

## Documentation Improvements

The MCP documentation page ([page.tsx](file:///Users/agustinmontoya/Attorneyshare/e2e-test-dashboard/app/docs/mcp/page.tsx)) could be enhanced with:

1. **Interactive playground** - Test tools directly from docs
2. **Response size estimates** - Help users choose efficient tools
3. **Tool selection guide** - Flowchart for "which tool should I use?"
4. **Rate limiting info** - Document any request limits
5. **Real examples** - Show actual response payloads
