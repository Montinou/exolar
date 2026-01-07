# lib/db.ts Analysis

**File**: `lib/db.ts`
**Total Lines**: 2970
**Analysis Date**: 2025-01-07

## Function Inventory by Domain

### 1. Connection & Configuration (Lines 34-54)
| Function | Export | Description |
|----------|--------|-------------|
| `getSql()` | yes | Creates Neon SQL connection |
| `setServiceAccountContext()` | yes | Sets RLS bypass for API key auth |

**Lines**: ~20

---

### 2. Executions - CRUD & Search (Lines 56-205)
| Function | Export | Description |
|----------|--------|-------------|
| `getExecutions()` | yes | Fetch executions with filters (status, branch, date, suite, runId) |
| `searchExecutions()` | yes | Search by branch, commit SHA, or suite name |
| `getExecutionById()` | yes | Get single execution by ID |
| `getTestResultsByExecutionId()` | yes | Get test results with artifacts for execution |

**Lines**: ~150

---

### 3. Execution Analysis (MCP Aggregation) (Lines 206-421)
| Function | Export | Description |
|----------|--------|-------------|
| `getFailedTestsByExecutionId()` | yes | Get only failed tests (lighter than full results) |
| `getExecutionSummary()` | yes | Aggregated summary without full test list |
| `getErrorDistributionByExecution()` | yes | Error patterns for specific execution |

**Interfaces**: `FailedTestResult`, `ExecutionSummary`

**Lines**: ~215

---

### 4. Dashboard Metrics (Lines 423-656)
| Function | Export | Description |
|----------|--------|-------------|
| `getDashboardMetrics()` | yes | Main dashboard stats (pass rate, failure rate, etc.) |
| `getTrendData()` | yes | Flexible time-series data (hourly/daily/weekly/monthly) |
| `getFailureTrendData()` | yes | Failure trend data by date |

**Interfaces/Types**: `DateRangeFilter`, `TrendPeriod`, `TrendOptions`, `TrendDataPoint`

**Lines**: ~235

---

### 5. Branch/Suite Statistics (Lines 658-788)
| Function | Export | Description |
|----------|--------|-------------|
| `getBranches()` | yes | Branches with full statistics (pass rate, last status) |
| `getSuites()` | yes | Suites with full statistics |

**Interfaces**: `BranchStatistics`, `SuiteStatistics`

**Lines**: ~130

---

### 6. Branch Accordion View (Lines 790-904)
| Function | Export | Description |
|----------|--------|-------------|
| `getExecutionsGroupedByBranch()` | yes | Group executions by branch for accordion UI |

**Lines**: ~115

---

### 7. Data Ingestion (Lines 906-1080)
| Function | Export | Description |
|----------|--------|-------------|
| `generateTestSignature()` | yes | MD5 hash signature for test identification |
| `insertExecution()` | yes | Insert new execution record |
| `insertTestResults()` | yes | Insert test results with flakiness tracking |
| `insertArtifacts()` | yes | Insert artifact records linked to test results |

**Lines**: ~175

---

### 8. Search & History (Lines 1082-1180)
| Function | Export | Description |
|----------|--------|-------------|
| `searchTests()` | yes | Search tests by name/file pattern |
| `getTestHistory()` | yes | Get run history for specific test |
| `getTestStatistics()` | yes | Get stats for specific test signature |

**Lines**: ~100

---

### 9. AI Context Analysis (Lines 1182-1374)
| Function | Export | Description |
|----------|--------|-------------|
| `getFailuresWithAIContext()` | yes | Get failed tests with AI context data |
| `getErrorTypeDistribution()` | yes | Error distribution with filters and grouping |

**Interfaces**: `ErrorDistributionOptions`, `ErrorDistributionItem`

**Lines**: ~195

---

### 10. Flakiness Detection (Lines 1376-1705)
| Function | Export | Description |
|----------|--------|-------------|
| `isTestFlaky()` | yes | Check if test is flaky based on retry/status |
| `getFlakiestTests()` | yes | Get flakiest tests with filters |
| `getFlakinessSummary()` | yes | Overall flakiness summary |
| `updateFlakinessHistory()` | yes | Update flakiness tracking on result insert |
| `getTestFlakiness()` | yes | Get flakiness data for specific test |

**Interfaces**: `GetFlakiestTestsOptions`, `GetFlakinessSummaryOptions`

**Lines**: ~330

---

### 11. Dashboard Analytics (Lines 1707-1769)
| Function | Export | Description |
|----------|--------|-------------|
| `getSlowestTests()` | yes | Get slowest tests by avg duration |
| `getSuitePassRates()` | yes | Get pass rates by suite |

**Interfaces**: `SlowestTest`, `SuitePassRate`

**Lines**: ~65

---

### 12. API Key Management (Lines 1771-1892)
| Function | Export | Description |
|----------|--------|-------------|
| `createApiKey()` | yes | Create new org API key |
| `getApiKeysByOrg()` | yes | Get all API keys for org |
| `getApiKeyByHash()` | yes | Get API key by hash (for validation) |
| `revokeApiKey()` | yes | Soft delete API key |
| `updateApiKeyLastUsed()` | yes | Update last_used timestamp |

**Interfaces**: `OrgApiKey`, `OrgApiKeyWithHash`

**Lines**: ~120

---

### 13. Reliability Score (Lines 1894-2010)
| Function | Export | Description |
|----------|--------|-------------|
| `getReliabilityScore()` | yes | Calculate 0-100 reliability score with breakdown |

**Interfaces**: `ReliabilityScoreOptions`

**Lines**: ~115

---

### 14. Performance Regression Detection (Lines 2012-2238)
| Function | Export | Description |
|----------|--------|-------------|
| `updatePerformanceBaselines()` | yes | Update 30-day rolling baselines |
| `getPerformanceRegressions()` | yes | Find tests exceeding baseline threshold |
| `getTestDurationHistory()` | yes | Duration history for trend charts |

**Interfaces**: `PerformanceRegressionsOptions`

**Lines**: ~225

---

### 15. Comparative Run Analysis (Lines 2240-2437)
| Function | Export | Description |
|----------|--------|-------------|
| `getLatestExecutionByBranch()` | yes | Get latest execution for branch |
| `compareExecutions()` | yes | Full diff between two executions |

**Lines**: ~200

---

### 16. Failure Classification (Auto-Triage) (Lines 2439-2864)
| Function | Export | Description |
|----------|--------|-------------|
| `extractErrorType()` | no (internal) | Extract error type from AI context/message |
| `calculateClassificationSignals()` | no (internal) | Calculate FLAKE vs BUG signals |
| `getFailureClassification()` | yes | Comprehensive failure classification data |

**Lines**: ~425

---

### 17. Org-Bound Query Helper (Lines 2866-2970)
| Function | Export | Description |
|----------|--------|-------------|
| `getQueriesForOrg()` | yes | Factory that binds all queries to an org ID |

**Lines**: ~105

---

## Summary by Domain

| Domain | Functions | Lines | % of File |
|--------|-----------|-------|-----------|
| Connection | 2 | ~20 | 0.7% |
| Executions CRUD | 4 | ~150 | 5.1% |
| Execution Analysis | 3 | ~215 | 7.2% |
| Dashboard Metrics | 3 | ~235 | 7.9% |
| Branch/Suite Stats | 2 | ~130 | 4.4% |
| Branch Accordion | 1 | ~115 | 3.9% |
| Data Ingestion | 4 | ~175 | 5.9% |
| Search & History | 3 | ~100 | 3.4% |
| AI Context | 2 | ~195 | 6.6% |
| Flakiness | 5 | ~330 | 11.1% |
| Dashboard Analytics | 2 | ~65 | 2.2% |
| API Keys | 5 | ~120 | 4.0% |
| Reliability Score | 1 | ~115 | 3.9% |
| Performance Regression | 3 | ~225 | 7.6% |
| Comparison | 2 | ~200 | 6.7% |
| Failure Classification | 3 | ~425 | 14.3% |
| Query Helper | 1 | ~105 | 3.5% |

---

## Dependency Analysis

### External Dependencies
```typescript
import { neon } from "@neondatabase/serverless"
import { createHash } from "crypto"
```

### Type Imports from `./types`
```typescript
TestExecution, TestResult, DashboardMetrics, TrendData, FailureTrendData,
ExecutionRequest, TestResultRequest, ArtifactRequest, TestSearchResult,
TestHistoryItem, TestStatistics, TestFlakinessHistory, FlakinessSummary,
BranchGroup, SuiteResult, ReliabilityScore, PerformanceRegression,
PerformanceRegressionSummary, DurationHistoryPoint, ComparisonResult,
TestComparisonItem, ComparisonExecutionInfo, TestDiffCategory,
FailureClassification, ClassificationSignal, ClassificationHistoricalMetrics,
RecentRun, ClassificationOptions
```

### Internal Function Dependencies
```
insertTestResults() → calls:
  ├── generateTestSignature()
  ├── isTestFlaky()
  └── updateFlakinessHistory()

insertArtifacts() → calls:
  └── generateTestSignature()

getExecutionSummary() → calls:
  └── getExecutionById()

compareExecutions() → calls:
  └── getExecutionById()

getFlakinessSummary() → calls:
  └── getFlakiestTests()

getFailureClassification() → calls:
  ├── extractErrorType() (internal)
  └── calculateClassificationSignals() (internal)

getQueriesForOrg() → binds all exported functions
```

### Shared Utilities
| Utility | Used By |
|---------|---------|
| `getSql()` | All query functions |
| `generateTestSignature()` | `insertTestResults()`, `insertArtifacts()` |
| `isTestFlaky()` | `insertTestResults()` |

### Internal-Only Functions (Not Exported)
1. `extractErrorType()` - Used only by `getFailureClassification()`
2. `calculateClassificationSignals()` - Used only by `getFailureClassification()`

---

## Identified Patterns

### Query Building Pattern
Most functions use a consistent pattern:
```typescript
const conditions = [`organization_id = ${organizationId}`]
// Add optional filters
if (filter) conditions.push(`column = '${value}'`)
const whereClause = `WHERE ${conditions.join(" AND ")}`
const result = await sql`SELECT ... ${sql.unsafe(whereClause)} ...`
```

### Function Groupings to Keep Together
1. **Ingestion Functions**: `insertExecution`, `insertTestResults`, `insertArtifacts`, `generateTestSignature` - share test signature logic
2. **Flakiness Functions**: `isTestFlaky`, `updateFlakinessHistory`, `getFlakiestTests`, etc. - interdependent
3. **Classification Functions**: `extractErrorType`, `calculateClassificationSignals`, `getFailureClassification` - tightly coupled
4. **Comparison Functions**: `compareExecutions`, `getLatestExecutionByBranch` - used together

---

## Migration Risks

### Low Risk
- Connection utilities (`getSql`, `setServiceAccountContext`)
- API key management functions (standalone)
- Branch/suite statistics (standalone)
- Dashboard analytics (standalone)

### Medium Risk
- Execution queries (core functionality, many consumers)
- Search & history (used by UI and MCP)
- Metrics/trends (dashboard depends on them)

### High Risk
- Flakiness functions (interdependent, called during ingestion)
- Failure classification (internal functions + exports)
- Query helper `getQueriesForOrg()` (must export everything)
