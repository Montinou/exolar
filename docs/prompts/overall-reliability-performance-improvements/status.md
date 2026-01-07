# Feature: Overall Reliability & Performance Improvements

## Status

| Field | Value |
|-------|-------|
| **Created** | 2026-01-07T19:52:35Z |
| **Updated** | 2026-01-07T21:05:13Z |
| **Current Phase** | Phase 3 (completed) |
| **Status** | in_progress |

## Summary

Comprehensive improvements for dashboard data consistency and filter behavior across ALL pages.

### Issue 1: Chart Data Consistency Problem
- **Root Cause**: Donut chart shows overlapping categories (passed + flaky) as pie slices
- **Solution**: Remove flaky from pie, show as separate badge below chart
- **Summary Bar**: Remove flaky from progress segments, keep as count badge

### Issue 2: Filter Behavior Inconsistency
- **Root Cause**: No "last run only" mode when filters are applied
- **Solution**: Add "Historic Summary" checkbox, implement lastRunOnly in database queries

### User Decisions
- Flaky indicator: **Badge below chart** (separate from pie)
- Summary bar: **Remove flaky from bar**, show as separate count badge
- Skipped tests: **Show in charts AND exclude from pass rate calculation**
- Pass rate formula: **passed / (passed + failed) * 100**

## Investigation Deliverables

| Deliverable | Status |
|-------------|--------|
| [investigation/analysis.md](investigation/analysis.md) | Created |
| [phases/01_chart_data_fixes.xml](phases/01_chart_data_fixes.xml) | Created |
| [phases/02_filter_component.xml](phases/02_filter_component.xml) | Created |
| [phases/03_database_queries.xml](phases/03_database_queries.xml) | Created |
| [phases/04_page_integration.xml](phases/04_page_integration.xml) | Created |
| [phases/05_documentation.xml](phases/05_documentation.xml) | Created |

## Phases

| Phase | Prompt | Description | Status |
|-------|--------|-------------|--------|
| 1 | [01_chart_data_fixes.xml](phases/01_chart_data_fixes.xml) | Fix overlapping categories in charts | completed |
| 2 | [02_filter_component.xml](phases/02_filter_component.xml) | Add "Historic Summary" checkbox | completed |
| 3 | [03_database_queries.xml](phases/03_database_queries.xml) | Add lastRunOnly parameter + Issue 5 & 7 fixes | completed |
| 4 | [04_page_integration.xml](phases/04_page_integration.xml) | Update all dashboard pages | pending |
| 5 | [05_documentation.xml](phases/05_documentation.xml) | Update docs and verify MCP | pending |

## Key Requirements

### Chart Rules
- Pie/donut charts MUST show mutually exclusive categories (100% total)
- Donut: Passed / Failed / Skipped only
- Flaky indicator: Separate badge, NOT a pie slice
- All charts on a page use same filtered dataset

### Filter Behavior
| Condition | Historic Checkbox | Data Shown |
|-----------|-------------------|------------|
| No filter | Hidden | All runs (aggregate) |
| Filter applied | Visible, unchecked | Last run only |
| Filter + checked | Visible, checked | All runs for filter |

## Critical Files

| Category | File |
|----------|------|
| Charts | `components/dashboard/status-donut-chart.tsx` |
| Charts | `components/dashboard/test-summary-bar.tsx` |
| Charts | `components/dashboard/stats-cards.tsx` |
| Filters | `components/dashboard/filters.tsx` |
| Database | `lib/db/metrics.ts` |
| Pages | `app/dashboard/page.tsx` |
| Pages | `app/dashboard/reliability/page.tsx` |
| Pages | `app/dashboard/performance/page.tsx` |

## Execution Log

| Date | Phase | Status | Notes |
|------|-------|--------|-------|
| 2026-01-07T20:34:17Z | Investigation | completed | Analysis complete, 5 phase prompts created |
| 2026-01-07T20:55:47Z | Phase 1 | completed | Chart data fixes - removed flaky from pie, added skipped segment, added tooltip |
| 2026-01-07T21:00:00Z | Phase 2 | completed | Historic Summary checkbox added to filters component |
| 2026-01-07T21:05:13Z | Phase 3 | completed | lastRunOnly parameter, Issue 5 (flakiness denominator), Issue 7 (completed_at ordering) |

## Phase 1 Changes

### Files Modified
1. `components/dashboard/status-donut-chart.tsx`
   - Replaced `flakyRate` with `flakyCount` (absolute number)
   - Added `skippedRate` prop for pie slice
   - Added Skipped to pie chart (gray color)
   - Added flaky badge below legend

2. `components/dashboard/test-summary-bar.tsx`
   - Added `skipped` prop
   - Added skipped segment to progress bar
   - Removed flaky from progress bar
   - Added tooltip to flaky count explaining overlap

3. `app/dashboard/page.tsx`
   - Added `skippedTests` extraction from metrics
   - Updated StatusDonutChart props
   - Updated TestSummaryBar props

4. `components/dashboard/stats-cards.tsx`
   - Added tooltip to Pass Rate stat explaining formula
   - Added info icon with hover tooltip

---

## Phase 2 Changes

### Files Modified
1. `components/dashboard/filters.tsx`
   - Added Checkbox and Label imports from shadcn/ui
   - Added `currentHistoric` state from URL param
   - Added `hasFilter` computed value (branch || suite)
   - Added "Historic Summary" checkbox that appears when filter is applied
   - Checkbox sets `?historic=true` URL parameter

---

## Phase 3 Changes

### Files Modified
1. `lib/db/metrics.ts`
   - Added `DashboardMetricsOptions` interface (extends DateRangeFilter with lastRunOnly, branch, suite)
   - Added `getLatestExecutionId()` helper function using `ORDER BY completed_at DESC` (Issue 7 fix)
   - Updated `getDashboardMetrics()` to support lastRunOnly and branch/suite filters
   - Updated latestExecution query to use `completed_at` for ordering

2. `lib/db/flakiness.ts`
   - **Issue 5 fix**: Changed flakiness_rate denominator from `passed_runs` to `total_runs`
   - Added `executionId` option to `getFlakiestTests()` for lastRunOnly support

3. `lib/db/types.ts`
   - Added `executionId?: number` to `GetFlakiestTestsOptions` interface

4. `lib/db/index.ts`
   - Exported `getLatestExecutionId` and `DashboardMetricsOptions`
   - Updated `getQueriesForOrg` to support new options

---

## Next Step

Execute Phase 4 - Page Integration:
```
Read and execute: docs/prompts/overall-reliability-performance-improvements/phases/04_page_integration.xml
```
