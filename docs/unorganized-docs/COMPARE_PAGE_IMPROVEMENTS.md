# Compare Page Enhancement Plan

## Executive Summary

The current compare page has **search functionality issues** and lacks a **branch-first comparison workflow** that would make the feature significantly more valuable. This document outlines the problems identified and proposes a comprehensive improvement plan.

---

## Current State Analysis

### What Works Well ✅

1. **API Support**: The `/api/compare` endpoint already supports branch-based comparison via `baseline_branch` and `current_branch` parameters
2. **Comparison Results**: `ComparisonSummaryCards` provides excellent visualization of pass rate, duration, test count deltas
3. **Test Diff Table**: `TestDiffTable` offers filtering by category (new failures, fixed, new tests, removed) with sorting capabilities
4. **Suite Filtering**: API supports `suite` parameter for filtering comparisons to specific test suites

### What's Broken ❌

1. **Search Not Working Properly**: The `ExecutionSelector` component filters client-side from only 50 pre-fetched executions, limiting search effectiveness
2. **Hidden Executions**: Each branch only shows 5 executions max, making it impossible to find older runs
3. **No Branch-First Workflow**: Users must manually select individual executions instead of simply comparing "latest run on branch A vs branch B"
4. **No Suite Pre-filtering**: Can't filter the dropdown by suite before selection

---

## Problem Deep Dive

### 1. Client-Side Search Limitations

```tsx
// Current implementation in ExecutionSelector (lines 56-68)
const filteredBranches = Object.entries(executionsByBranch).filter(([branch, execs]) => {
  if (!search) return true
  const searchLower = search.toLowerCase()
  return (
    branch.toLowerCase().includes(searchLower) ||
    execs.some(
      (e) =>
        e.commit_sha.toLowerCase().includes(searchLower) ||
        e.suite?.toLowerCase().includes(searchLower)
    )
  )
})
```

**Issues:**
- Filters from a static list of 50 executions fetched on page load
- If user wants to find commit `abc1234` that's not in the top 50, search returns nothing
- Shows max 5 executions per branch (line 156: `branchExecutions.slice(0, 5)`)

### 2. Missing Branch-to-Branch Comparison Mode

The API already supports this via `baseline_branch` and `current_branch` parameters, but the UI has **no way to use them**:

```typescript
// API route.ts (lines 44-64) - Already implemented!
if (baselineBranch && !resolvedBaselineId) {
  const baselineExecution = await db.getLatestExecutionByBranch(baselineBranch, suite)
  // ...
}
```

This is the **most valuable comparison workflow** (e.g., "compare my feature branch against main") but is completely hidden from users.

---

## Proposed Improvements

### Phase 1: Fix Core Search Issues

#### 1.1 Add Server-Side Search Endpoint

**New API:** `GET /api/executions/search`

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query (branch, commit SHA, suite) |
| `limit` | number | Max results (default: 20) |
| `branch` | string | Optional: filter to specific branch |
| `suite` | string | Optional: filter to specific suite |

**New DB Function:**
```typescript
searchExecutions(organizationId: number, query: string, options?: {
  limit?: number
  branch?: string
  suite?: string
}): Promise<TestExecution[]>
```

#### 1.2 Debounced Search in ExecutionSelector

- Add 300ms debounce on search input
- Fetch results from server when user types
- Combine with local results for instant feedback

---

### Phase 2: Branch-First Comparison Mode

> [!IMPORTANT]
> This is the highest-impact improvement. Users primarily want to compare branches, not find specific executions.

#### 2.1 Two-Mode Selector Component

Create a **tabbed interface** with two modes:

**Mode A: Branch Comparison (Default)**
```
┌─────────────────────────────────────────────────────────────┐
│  [🌿 Branch Mode]   [📋 Execution Mode]                     │
├─────────────────────────────────────────────────────────────┤
│  Baseline Branch        ↔️        Current Branch             │
│  ┌──────────────────┐        ┌──────────────────┐          │
│  │ main          ▼ │        │ feature/xyz   ▼ │          │
│  └──────────────────┘        └──────────────────┘          │
│                                                             │
│  Suite Filter (optional)                                    │
│  ┌──────────────────────────────────────────────┐          │
│  │ All Suites                                ▼ │          │
│  └──────────────────────────────────────────────┘          │
│                                                             │
│  Latest executions will be compared automatically           │
└─────────────────────────────────────────────────────────────┘
```

**Mode B: Execution Mode (Current behavior, improved)**
- Keep existing ExecutionSelector but with server-side search
- Add "Load more" button per branch
- Show total execution count per branch

#### 2.2 Branch Selector Component

**New Component:** `BranchSelector`

| Feature | Description |
|---------|-------------|
| **Searchable Dropdown** | Fuzzy search across all branches |
| **Statistics Preview** | Show pass rate, last run, execution count inline |
| **Recent First** | Sort branches by last activity |
| **Quick Actions** | "Compare with main" button for feature branches |

---

### Phase 3: Enhanced Comparison Results

#### 3.1 Performance Regression Insights

Add a dedicated section for performance changes:

```
┌──────────────────────────────────────────────────────────┐
│  ⚡ Performance Impact                                    │
├──────────────────────────────────────────────────────────┤
│  🔴 3 regressions (>20% slower)                          │
│  🟢 5 improvements (>20% faster)                          │
│  ⚪ 142 stable tests                                      │
│                                                          │
│  [View Performance Details ▼]                            │
└──────────────────────────────────────────────────────────┘
```

#### 3.2 Flaky Test Filtering

Add filter option to hide tests known to be flaky:

```typescript
// New API parameter
filter: 'exclude_flaky' | 'only_flaky' | 'all'
```

#### 3.3 Export Comparison Report

Button to export comparison as:
- Markdown summary (for PR comments)
- JSON (for CI pipeline consumption)

---

## Implementation Priority

| Priority | Feature | Impact | Effort |
|----------|---------|--------|--------|
| 🔴 P0 | Server-side search API | High | Medium |
| 🔴 P0 | Branch comparison mode | Very High | Medium |
| 🟡 P1 | Enhanced ExecutionSelector | Medium | Low |
| 🟡 P1 | Branch selector with stats | High | Medium |
| 🟢 P2 | Performance insights section | Medium | Low |
| 🟢 P2 | Flaky test filtering | Medium | Low |
| 🟢 P3 | Export comparison report | Low | Low |

---

## Technical Implementation Details

### New Files to Create

| File | Purpose |
|------|---------|
| `app/api/executions/search/route.ts` | Server-side execution search endpoint |
| `components/dashboard/branch-selector.tsx` | Branch selection with search and stats |
| `components/dashboard/comparison-mode-tabs.tsx` | Tab switcher for Branch/Execution modes |
| `lib/db.ts` (modify) | Add `searchExecutions()` function |

### Files to Modify

| File | Changes |
|------|---------|
| `components/dashboard/execution-selector.tsx` | Add server-side search, "load more" button |
| `app/dashboard/compare/compare-client.tsx` | Add mode switching, branch comparison support |
| `app/dashboard/compare/page.tsx` | Pass additional props for branch lists with stats |

### Database Query for Search

```sql
-- searchExecutions query
SELECT *
FROM test_executions
WHERE organization_id = $1
  AND (
    branch ILIKE '%' || $2 || '%'
    OR commit_sha ILIKE '%' || $2 || '%'
    OR suite ILIKE '%' || $2 || '%'
  )
ORDER BY started_at DESC
LIMIT $3
```

---

## UX Wireframes

### Branch Comparison Flow

```
User arrives at /dashboard/compare
           │
           ▼
┌─────────────────────────────────┐
│  Select Comparison Mode         │
│  [🌿 Branch Mode*] [📋 Execution]│
└─────────────────────────────────┘
           │
           ▼ (Branch Mode selected)
┌─────────────────────────────────┐
│  Baseline: [main ▼]              │
│  Current:  [feature/login ▼]     │
│  Suite:    [All ▼]               │
│                                  │
│  [Compare Branches →]            │
└─────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│  Comparing latest runs:          │
│  main (c60e951) Jan 3, 03:21 AM │
│       ⇄                          │
│  feature/login (abc1234) Jan 3  │
└─────────────────────────────────┘
           │
           ▼
   [Comparison Results]
```

### Improved Execution Selector

```
┌──────────────────────────────────┐
│ 🔍 Search branches, commits...   │
├──────────────────────────────────┤
│ 📊 15 executions found           │
├──────────────────────────────────┤
│ 🌿 main (8 runs)                 │
│   ├ c60e951 • Jan 3 • 19/31 ✓    │
│   ├ abc1234 • Jan 2 • 31/31 ✓    │
│   ├ def5678 • Jan 1 • 28/31 ✓    │
│   └ [Load 5 more...]             │
├──────────────────────────────────┤
│ 🌿 feature/login (4 runs)        │
│   ├ 789cdef • Jan 3 • 0/33 ✗     │
│   └ [Load 3 more...]             │
└──────────────────────────────────┘
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Executions visible in dropdown | 50 (top only) | All (paginated) |
| Time to compare two branches | ~30s (manual search) | ~5s (2 clicks) |
| Search success rate | Low (client-side limited) | High (server-side full) |

---

## Open Questions for Discussion

1. **Default comparison baseline**: Should we default to comparing against `main` or the most recent execution?

2. **Historical comparison**: Should users be able to compare any two historical executions from the same branch (e.g., "yesterday vs last week")?

3. **Deep linking**: Should branch comparison mode support URL params for direct linking (e.g., `/dashboard/compare?baseline_branch=main&current_branch=feature/xyz`)?

4. **Notification integration**: Should we trigger alerts when a comparison shows significant regressions?

---

## Next Steps

1. ✅ Analysis complete (this document)
2. ⏳ Review and approve this plan
3. ⬜ Implement Phase 1 (Core Search Fixes)
4. ⬜ Implement Phase 2 (Branch Comparison Mode)
5. ⬜ Implement Phase 3 (Enhanced Results)
