# Proposed Database Module Structure

**Created**: 2025-01-07

## Goal

Reorganize `lib/db.ts` (~2970 lines) into a cleaner `lib/db/` folder structure that:
- Groups related functions by domain
- Makes it obvious where to add new queries
- Preserves 100% backwards compatibility
- Requires no changes to consumers

---

## Proposed File Structure

```
lib/db/
├── index.ts              # Re-exports everything (backwards compatible)
├── connection.ts         # Database connection utilities
├── executions.ts         # Execution CRUD and search
├── results.ts            # Test results queries
├── metrics.ts            # Dashboard metrics and trends
├── flakiness.ts          # Flakiness detection and tracking
├── performance.ts        # Performance regression detection
├── comparison.ts         # Execution comparison
├── classification.ts     # Failure classification (auto-triage)
├── api-keys.ts           # API key management
├── ingestion.ts          # Data insertion functions
├── utils.ts              # Shared utilities
└── types.ts              # Local interfaces (not from lib/types.ts)
```

---

## File Contents Mapping

### `connection.ts` (~30 lines)
```typescript
// Exports
export { getSql, setServiceAccountContext }

// Internal
- getSql()
- setServiceAccountContext()
```

### `utils.ts` (~20 lines)
```typescript
// Exports
export { generateTestSignature, isTestFlaky }

// Depends on: crypto (createHash)
```

### `types.ts` (~100 lines)
```typescript
// Local interfaces defined in db.ts (NOT from lib/types.ts)
export interface DateRangeFilter { ... }
export interface FailedTestResult { ... }
export interface ExecutionSummary { ... }
export type TrendPeriod = ...
export interface TrendOptions { ... }
export interface TrendDataPoint { ... }
export interface BranchStatistics { ... }
export interface SuiteStatistics { ... }
export interface GetFlakiestTestsOptions { ... }
export interface GetFlakinessSummaryOptions { ... }
export interface SlowestTest { ... }
export interface SuitePassRate { ... }
export interface OrgApiKey { ... }
export interface OrgApiKeyWithHash { ... }
export interface ReliabilityScoreOptions { ... }
export interface PerformanceRegressionsOptions { ... }
export interface ErrorDistributionOptions { ... }
export interface ErrorDistributionItem { ... }
```

### `executions.ts` (~200 lines)
```typescript
// Exports
export {
  getExecutions,
  searchExecutions,
  getExecutionById,
  getExecutionsGroupedByBranch,
}

// Depends on: connection.ts (getSql)
```

### `results.ts` (~250 lines)
```typescript
// Exports
export {
  getTestResultsByExecutionId,
  getFailedTestsByExecutionId,
  getExecutionSummary,
  getErrorDistributionByExecution,
}

// Depends on:
// - connection.ts (getSql)
// - executions.ts (getExecutionById)
```

### `metrics.ts` (~400 lines)
```typescript
// Exports
export {
  getDashboardMetrics,
  getTrendData,
  getFailureTrendData,
  getBranches,
  getSuites,
  getSlowestTests,
  getSuitePassRates,
  getReliabilityScore,
}

// Depends on: connection.ts (getSql)
```

### `flakiness.ts` (~350 lines)
```typescript
// Exports
export {
  getFlakiestTests,
  getFlakinessSummary,
  updateFlakinessHistory,
  getTestFlakiness,
}

// Depends on:
// - connection.ts (getSql)
// - utils.ts (isTestFlaky)
```

### `performance.ts` (~250 lines)
```typescript
// Exports
export {
  updatePerformanceBaselines,
  getPerformanceRegressions,
  getTestDurationHistory,
}

// Depends on: connection.ts (getSql)
```

### `comparison.ts` (~220 lines)
```typescript
// Exports
export {
  getLatestExecutionByBranch,
  compareExecutions,
}

// Depends on:
// - connection.ts (getSql)
// - executions.ts (getExecutionById)
```

### `classification.ts` (~450 lines)
```typescript
// Exports
export { getFailureClassification }

// Internal (not exported)
- extractErrorType()
- calculateClassificationSignals()

// Depends on: connection.ts (getSql)
```

### `api-keys.ts` (~130 lines)
```typescript
// Exports
export {
  createApiKey,
  getApiKeysByOrg,
  getApiKeyByHash,
  revokeApiKey,
  updateApiKeyLastUsed,
}

// Depends on: connection.ts (getSql)
```

### `ingestion.ts` (~200 lines)
```typescript
// Exports
export {
  insertExecution,
  insertTestResults,
  insertArtifacts,
}

// Depends on:
// - connection.ts (getSql)
// - utils.ts (generateTestSignature, isTestFlaky)
// - flakiness.ts (updateFlakinessHistory)
```

### `search.ts` (~120 lines)
```typescript
// Exports
export {
  searchTests,
  getTestHistory,
  getTestStatistics,
  getFailuresWithAIContext,
  getErrorTypeDistribution,
}

// Depends on: connection.ts (getSql)
```

### `index.ts` (~150 lines)
```typescript
// Re-export everything for backwards compatibility
export * from "./connection"
export * from "./utils"
export * from "./types"
export * from "./executions"
export * from "./results"
export * from "./metrics"
export * from "./flakiness"
export * from "./performance"
export * from "./comparison"
export * from "./classification"
export * from "./api-keys"
export * from "./ingestion"
export * from "./search"

// Export the org-bound query helper
export { getQueriesForOrg }

// The getQueriesForOrg function that binds all queries to an org
export function getQueriesForOrg(organizationId: number) {
  return {
    // ... all bound functions
  }
}
```

---

## Migration Order (Safest First)

### Phase 1: Setup Structure
1. Create `lib/db/` folder
2. Create `lib/db/index.ts` that just re-exports from `../db.ts`
3. Update any imports to use `lib/db` (if any exist)
4. Verify nothing breaks

### Phase 2: Extract Utilities
1. Create `lib/db/connection.ts` with `getSql`, `setServiceAccountContext`
2. Create `lib/db/utils.ts` with `generateTestSignature`, `isTestFlaky`
3. Create `lib/db/types.ts` with local interfaces
4. Update `lib/db.ts` to import from these files
5. Verify nothing breaks

### Phase 3: Extract Domain Files (One at a Time)
**Order based on dependency risk (lowest first):**

1. `api-keys.ts` - Standalone, no internal deps
2. `metrics.ts` - Standalone except for getSql
3. `performance.ts` - Standalone except for getSql
4. `search.ts` - Standalone except for getSql
5. `executions.ts` - Used by results.ts and comparison.ts
6. `results.ts` - Depends on executions.ts
7. `flakiness.ts` - Depends on utils.ts
8. `comparison.ts` - Depends on executions.ts
9. `classification.ts` - Self-contained with internal functions
10. `ingestion.ts` - Depends on utils.ts and flakiness.ts

### Phase 4: Finalize
1. Move `getQueriesForOrg` to `index.ts`
2. Delete original `lib/db.ts`
3. Update `lib/db/index.ts` to properly export everything
4. Run full test suite
5. Clean up any unused imports

---

## Backwards Compatibility Strategy

The key is that `lib/db/index.ts` exports everything that `lib/db.ts` currently exports:

```typescript
// Before: import { getExecutions } from "@/lib/db"
// After:  import { getExecutions } from "@/lib/db" (same!)

// This works because:
// - lib/db.ts → moves to lib/db/index.ts
// - Next.js resolves lib/db to lib/db/index.ts automatically
```

**Verification**: After each phase, run:
```bash
# Type check
npm run build

# Search for broken imports
grep -r "from ['\"]@/lib/db['\"]" --include="*.ts" --include="*.tsx"
```

---

## Files That Need Updates

After migration, these patterns will need verification:

1. **API Routes**: `app/api/**/*.ts` - Use `@/lib/db`
2. **Server Components**: `app/**/page.tsx` - Use `@/lib/db`
3. **MCP Server**: `lib/mcp/*.ts` - Use `@/lib/db`

All should continue working if `index.ts` exports everything correctly.

---

## Estimated Effort

| Phase | Files | Estimated Effort |
|-------|-------|------------------|
| Phase 1: Setup | 2 | 15 min |
| Phase 2: Utilities | 3 | 30 min |
| Phase 3: Domains | 10 | 2-3 hours |
| Phase 4: Finalize | 2 | 30 min |
| **Total** | 17 | ~4 hours |

---

## Success Criteria

1. All existing imports work without changes
2. `npm run build` passes
3. All API routes function correctly
4. MCP tools work correctly
5. No runtime errors in dashboard
6. Each domain file is <400 lines
7. Clear separation of concerns
