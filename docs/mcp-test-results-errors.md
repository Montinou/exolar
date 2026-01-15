# Exolar MCP Test Results - ERRORS

**Date:** 2026-01-13
**Total Failed Tests:** 6

---

## 1. query_exolar_data Errors (4 errors)

### Error 1.1: trends Dataset
- **Input:** `{ dataset: "trends", filters: { period: "day", count: 7 } }`
- **Error Type:** Runtime Error
- **Error Message:**
```json
{"error":"(intermediate value).map is not a function"}
```
- **Severity:** HIGH
- **Root Cause:** The trends handler is attempting to call `.map()` on a non-array value. Likely the database query returns a single object or null instead of an array.
- **Suggested Fix:**
  1. Check `lib/mcp/handlers/query.ts` for the trends case
  2. Ensure the database query returns an array
  3. Add null/type check before mapping: `Array.isArray(data) ? data.map(...) : []`

### Error 1.2: org_suites Dataset (Schema Mismatch)
- **Input:** `{ dataset: "org_suites" }`
- **Error Type:** Validation Error (MCP -32602)
- **Error Message:**
```
Invalid enum value. Expected 'executions' | 'execution_details' | ... | 'semantic_search',
received 'org_suites'
```
- **Severity:** MEDIUM
- **Root Cause:** The `explore_exolar_index` tool returns `org_suites` as an available dataset, but the `query_exolar_data` tool's Zod schema doesn't include it in the allowed enum values.
- **Suggested Fix:**
  1. Add `org_suites`, `suite_tests`, and `inactive_tests` to the dataset enum in `lib/mcp/tools.ts`
  2. Implement handlers for these datasets in `lib/mcp/handlers/query.ts`
  3. OR remove these from the explore response if they're not meant to be queried

### Error 1.3: error_analysis Dataset (Returns Raw SQL)
- **Input:** `{ dataset: "error_analysis" }`
- **Error Type:** Logic Error
- **Response (incorrect):**
```json
{
  "dataset": "error_analysis",
  "group_by": "error_type",
  "data": {
    "sql": "SELECT ... FROM test_results tr ..."
  }
}
```
- **Severity:** HIGH
- **Root Cause:** The handler is returning the SQL query string instead of executing it and returning the results.
- **Suggested Fix:**
  1. In `lib/mcp/handlers/query.ts`, find the error_analysis case
  2. Change from returning `{ sql: query }` to actually executing: `await sql(query)`
  3. Return the query results instead of the query itself

### Error 1.4: failures Dataset (Returns Raw SQL)
- **Input:** `{ dataset: "failures", filters: { limit: 5 } }`
- **Error Type:** Logic Error
- **Response (incorrect):**
```json
{
  "dataset": "failures",
  "data": {
    "sql": "SELECT tr.id, tr.execution_id, tr.test_name... FROM test_results tr..."
  }
}
```
- **Severity:** HIGH
- **Root Cause:** Same as error_analysis - returns SQL string instead of executing it.
- **Suggested Fix:**
  1. In `lib/mcp/handlers/query.ts`, find the failures case
  2. Execute the SQL query and return results
  3. Consider extracting common query execution logic to avoid duplication

---

## 2. perform_exolar_action Errors (2 errors)

### Error 2.1: compare Action (Branch Not Found)
- **Input:** `{ action: "compare", params: { baseline_branch: "main", current_branch: "..." } }`
- **Error Type:** Data Not Found
- **Error Message:**
```json
{"error":"No execution found for branch \"main\""}
```
- **Severity:** LOW
- **Root Cause:** The compare action by branch name requires executions to exist for that branch. The "main" branch has no test executions in the database.
- **Note:** This is expected behavior when branch has no executions. The error message is clear.
- **Suggested Enhancement:**
  1. Return available branches in the error message
  2. Example: `No execution found for branch "main". Available: refactor/ENG-767, feature/ENG-950...`

### Error 2.2: classify Action (Undefined Property)
- **Input:** `{ action: "classify", params: { execution_id: 240, test_name: "Waterfall Attorney: accept -> sign flow" } }`
- **Error Type:** Runtime Error
- **Error Message:**
```json
{"error":"Cannot read properties of undefined (reading 'test_signature')"}
```
- **Severity:** HIGH
- **Root Cause:** The classify handler is trying to access `test_signature` on an undefined object. The test lookup by name likely failed but wasn't handled properly.
- **Suggested Fix:**
  1. In `lib/mcp/handlers/action.ts`, find the classify case
  2. Add null check after test lookup:
  ```typescript
  const test = await findTestByName(execution_id, test_name);
  if (!test) {
    return { error: `Test "${test_name}" not found in execution ${execution_id}` };
  }
  const signature = test.test_signature;
  ```
  3. Consider supporting lookup by `test_signature` directly as an alternative

---

## 3. clustered_failures Dataset Error

### Error 3.1: No Failures to Cluster
- **Input:** `{ dataset: "clustered_failures", filters: { execution_id: 150 } }`
- **Error Type:** Data Not Found
- **Error Message:**
```json
{"error":"Execution not found or no failures to cluster"}
```
- **Severity:** LOW
- **Root Cause:** Execution 150 either doesn't exist or has no failed tests to cluster.
- **Note:** This is expected behavior. The error message could be more specific.
- **Suggested Enhancement:**
  1. Differentiate between "execution not found" and "no failures"
  2. Return execution info with "0 failures to cluster" instead of error

---

## Summary of Issues by Severity

### HIGH Severity (Blocking) - 4 issues
| Issue | Tool | Problem |
|-------|------|---------|
| trends dataset | query_exolar_data | `.map()` on non-array |
| error_analysis | query_exolar_data | Returns SQL instead of results |
| failures | query_exolar_data | Returns SQL instead of results |
| classify action | perform_exolar_action | Undefined property access |

### MEDIUM Severity - 1 issue
| Issue | Tool | Problem |
|-------|------|---------|
| Schema mismatch | query_exolar_data | org_suites/suite_tests/inactive_tests not in enum |

### LOW Severity (Expected Behavior) - 2 issues
| Issue | Tool | Problem |
|-------|------|---------|
| Branch not found | perform_exolar_action | No executions for "main" branch |
| No failures | query_exolar_data | No failures to cluster in execution |

---

## Recommended Priority Fixes

### Priority 1: Fix SQL Execution (HIGH)
Files to modify: `lib/mcp/handlers/query.ts`

```typescript
// For error_analysis and failures cases, change from:
return { data: { sql: query } };

// To:
const results = await sql(query);
return { data: results.rows || results };
```

### Priority 2: Fix trends Handler (HIGH)
File: `lib/mcp/handlers/query.ts`

```typescript
// Add type checking before map:
const trends = await getTrends(filters);
if (!Array.isArray(trends)) {
  return { data: [], error: "No trend data available" };
}
return { data: trends.map(...) };
```

### Priority 3: Fix classify Handler (HIGH)
File: `lib/mcp/handlers/action.ts`

```typescript
// Add null check:
const test = await findTest(execution_id, test_name);
if (!test) {
  return { error: `Test not found: "${test_name}"` };
}
```

### Priority 4: Sync Schema with Explore (MEDIUM)
File: `lib/mcp/tools.ts`

Either:
- Add `org_suites`, `suite_tests`, `inactive_tests` to dataset enum
- OR remove them from explore_exolar_index response

---

## Files Requiring Changes

| File | Changes Needed |
|------|---------------|
| `lib/mcp/handlers/query.ts` | Fix trends, error_analysis, failures handlers |
| `lib/mcp/handlers/action.ts` | Fix classify handler null check |
| `lib/mcp/tools.ts` | Sync dataset enum with explore response |
