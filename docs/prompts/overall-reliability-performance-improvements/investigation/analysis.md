# Investigation Analysis: Overall Reliability & Performance Improvements

**Date**: 2026-01-07
**Feature**: overall-reliability-performance-improvements
**Phase**: Initial Investigation

---

## Executive Summary

Two critical issues were identified and analyzed:

1. **Chart Data Consistency**: Donut chart displays overlapping categories (passed + flaky) as pie slices, causing percentages that don't add to 100%
2. **Filter Behavior**: No "last run only" mode when filters are applied - always shows aggregated data

**User Decisions:**
- Flaky indicator: Badge below chart (separate from pie slices)
- Summary bar: Remove flaky from bar segments, keep as count badge

---

## Issue 1: Chart Data Consistency Problem

### Root Cause Analysis

#### StatusDonutChart Component
**File**: `components/dashboard/status-donut-chart.tsx`

Current implementation:
```typescript
interface StatusDonutChartProps {
  passRate: number
  failRate: number
  flakyRate: number  // Problem: treated as separate pie slice
  title?: string
}

const data = [
  { name: "Passed", value: passRate, color: COLORS.passed },
  { name: "Failed", value: failRate, color: COLORS.failed },
  { name: "Flaky", value: flakyRate, color: COLORS.flaky },  // Creates 3rd slice
].filter((item) => item.value > 0)
```

**Problem**: The component creates 3 pie slices treating them as mutually exclusive categories. However:
- `passed` and `failed` ARE mutually exclusive (from execution test counts)
- `flaky` is NOT mutually exclusive - it comes from a separate history table
- A test can be BOTH "passed" AND "flaky"

#### TestSummaryBar Component
**File**: `components/dashboard/test-summary-bar.tsx`

Current implementation:
```typescript
interface TestSummaryBarProps {
  total: number
  passed: number
  failed: number
  flaky: number
}

// Progress bar shows all three as segments
{passedPercent > 0 && <div style={{ width: `${passedPercent}%` }} />}
{failedPercent > 0 && <div style={{ width: `${failedPercent}%` }} />}
{flakyPercent > 0 && <div style={{ width: `${flakyPercent}%` }} />}  // Problem
```

**Problem**: Bar segments may exceed 100% if flaky overlaps with passed.

#### Data Source Analysis
**File**: `lib/db/metrics.ts` - getDashboardMetrics()

```sql
-- Passed/Failed come from latest execution (mutually exclusive)
SELECT total_tests, passed, failed, skipped
FROM test_executions
WHERE organization_id = $1 AND completed_at IS NOT NULL
ORDER BY started_at DESC LIMIT 1

-- Flaky comes from separate aggregate table (overlapping)
SELECT COUNT(*) as flaky_count
FROM test_flakiness_history
WHERE organization_id = $1 AND flaky_runs > 0
```

**Key Insight**: Test status and flakiness are orthogonal dimensions:
- Status: passed | failed | skipped (mutually exclusive per execution)
- Flaky: boolean flag based on historical behavior (can apply to any status)

### Solution Design

**StatusDonutChart**:
1. Remove `flakyRate` from pie data array
2. Add new prop `flakyCount?: number` (absolute count)
3. Add badge below legend showing flaky count

**TestSummaryBar**:
1. Remove flaky from progress bar segments
2. Keep flaky count in header with clarifying tooltip
3. Add note: "Flaky tests may overlap with passed tests"

---

## Issue 2: Filter Behavior - "Last Run Only" Mode

### Current State Analysis

#### Filters Component
**File**: `components/dashboard/filters.tsx`

Current filter parameters:
- `branch`: Dropdown select via URL param
- `suite`: Dropdown select via URL param
- `status`: Dropdown select (disabled on reliability/performance pages)
- `from`/`to`: Date range picker via URL params

**No "Historic Summary" toggle exists**.

#### Database Query Analysis

All database functions aggregate ALL executions in the time range:

| Function | File | Current Behavior |
|----------|------|-----------------|
| `getDashboardMetrics()` | lib/db/metrics.ts | Aggregates all executions |
| `getReliabilityScore()` | lib/db/metrics.ts | Uses 7-day windows |
| `getFlakiestTests()` | lib/db/flakiness.ts | Aggregates from history table |
| `getExecutions()` | lib/db/executions.ts | Returns list, no aggregation |

**No function supports `lastRunOnly` parameter**.

#### API Endpoints Analysis

| Endpoint | Parameters | Needs Update |
|----------|-----------|--------------|
| `/api/reliability-score` | from, to, branch, suite | Add lastRunOnly |
| `/api/executions` | status, branch, suite, from, to | Already supports filtering |
| `/api/metrics` | dateRange only | Add lastRunOnly |
| `/api/flakiness` | since, branch, suite | Add executionId filter |
| `/api/mcp` | Various | Update tool definitions |

### Solution Design

#### Filter Behavior Matrix

| Condition | Historic Checkbox | Data Shown |
|-----------|-------------------|------------|
| No filters applied | Hidden | All runs (historical aggregate) |
| Branch/suite selected | Visible, unchecked by default | Last run only |
| Filter + Historic checked | Visible, checked | All runs for filter |

#### URL Parameter
Add `?historic=true` to URL params when filter is applied.

#### Database Query Pattern
```sql
-- Helper to get latest execution ID
WITH latest AS (
  SELECT id FROM test_executions
  WHERE organization_id = $1
    AND ($2::text IS NULL OR branch = $2)
    AND ($3::text IS NULL OR suite = $3)
  ORDER BY started_at DESC
  LIMIT 1
)
-- Filter metrics to that execution
SELECT ... FROM test_results
WHERE execution_id = (SELECT id FROM latest)
```

---

## Component Inventory

### Main Dashboard (/)
| Component | Data Source | Overlapping Issue |
|-----------|-------------|-------------------|
| StatusDonutChart | Latest execution + flakiness_history | YES - flaky as pie slice |
| TestSummaryBar | Latest execution + flakiness_history | YES - flaky in bar |
| StatsCards | Aggregated metrics | Different granularity |
| FailureRateChart | Time-series trends | NO |
| ErrorDistributionChart | Error categorization | NO |

### Reliability Page (/dashboard/reliability)
| Component | Data Source | Filter Support |
|-----------|-------------|----------------|
| ReliabilityScoreCard | getReliabilityScore() | branch, suite, dateRange |
| FlakiestTestsCard | getFlakiestTests() | since, branch, suite |
| Score Breakdown | getReliabilityScore() | Same as above |

### Performance Page (/dashboard/performance)
| Component | Data Source | Filter Support |
|-----------|-------------|----------------|
| PerformanceAlertsCard | getPerformanceRegressions() | hours, branch, suite |
| SlowestTestsCard | getSlowestTests() | Fixed 7 days |
| FailureRateChart | getTrendData() | period, dateRange |

### Shared Components
| Component | Location | Needs Update |
|-----------|----------|--------------|
| Filters | components/dashboard/filters.tsx | Add Historic checkbox |

---

## Files to Modify

### Phase 1: Chart Data Fixes
- `components/dashboard/status-donut-chart.tsx`
- `components/dashboard/test-summary-bar.tsx`
- `app/dashboard/page.tsx`

### Phase 2: Filter Component
- `components/dashboard/filters.tsx`

### Phase 3: Database Queries
- `lib/db/metrics.ts`
- `lib/db/flakiness.ts`
- `lib/db/index.ts`

### Phase 4: Page Integration
- `app/dashboard/page.tsx`
- `app/dashboard/reliability/page.tsx`
- `app/dashboard/performance/page.tsx`

### Phase 5: Documentation
- `CLAUDE.md`
- `docs/MCP_INTEGRATION.md`
- `docs/MODERN_DASHBOARD_FEATURES.md`

---

## Implementation Phases

| Phase | Focus | Priority |
|-------|-------|----------|
| 1 | Chart Data Fixes | Critical |
| 2 | Filter Component Update | High |
| 3 | Database Query Updates | High |
| 4 | Page Integration | Medium |
| 5 | Documentation & Testing | Medium |

---

## Success Criteria

- [ ] Donut chart shows only passed/failed/skipped (adds to 100%)
- [ ] Flaky count shown as separate badge below chart
- [ ] Summary bar excludes flaky from progress segments
- [ ] "Historic Summary" checkbox visible when filter applied
- [ ] Last run only mode works for all metrics
- [ ] All documentation updated
- [ ] MCP tools compatible with new parameters
