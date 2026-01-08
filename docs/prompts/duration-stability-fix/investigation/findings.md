# Duration Stability Fix - Investigation Findings

**Completed:** 2026-01-08T00:44:19Z

## Problem Summary

Duration Stability was showing incorrect values because the formula measured **uniformity of test durations** instead of **stability over time**.

### Symptoms
- Single-run analysis (`lastRunOnly=true`) showed 0% stability → contributing +0 to reliability score
- Multi-run analysis showed low stability even when individual tests had consistent durations
- A run with tests ranging 2s-60s got high CV = low stability (incorrect interpretation)

## Root Cause

### Previous Formula (Incorrect)
```sql
STDDEV(all_test_durations) / AVG(all_test_durations)
```

This calculated coefficient of variation across ALL test results in the period, mixing different tests together:
- Test A: 2s duration
- Test B: 60s duration
- Test C: 30s duration
- STDDEV([2, 60, 30]) / AVG([2, 60, 30]) = high CV = low "stability"

This measured **uniformity** (do all tests take the same time?) not **stability** (is each test consistent across runs?).

### Correct Approach
Calculate CV for each test across its runs, then average:
- Test A runs: [2s, 2.1s, 1.9s] → CV ≈ 0.05 (stable)
- Test B runs: [60s, 61s, 59s] → CV ≈ 0.017 (stable)
- Average CV ≈ 0.034 → 97% stability

## Files Involved

| File | Lines | Purpose |
|------|-------|---------|
| `lib/db/metrics.ts` | 556-639 | Core `getReliabilityScore()` calculation |
| `app/api/reliability-score/route.ts` | 7-32 | API endpoint accepting filters |
| `app/dashboard/reliability/page.tsx` | 40-166 | Dashboard page with filter logic |
| `components/dashboard/reliability-score.tsx` | 170-187 | Score display component |

## Solution Implemented

### 1. Single-Run Fix (Already Existed)
Commit `9d557a8` added:
```typescript
const effectiveDurationCV = lastRunOnly ? 0 : Number(row.duration_cv) || 0
```
When `lastRunOnly=true`, CV is set to 0 → 100% stability → +30 contribution.

### 2. Per-Test Stability Calculation (New)
Modified the SQL to use CTEs that:
1. Group tests by `test_name` + `file`
2. Calculate STDDEV and AVG per test across runs
3. Compute CV for each test
4. Average all test CVs for overall stability

```sql
WITH current_per_test_cv AS (
  SELECT
    CASE
      WHEN AVG(tr.duration_ms) > 0
      THEN COALESCE(STDDEV(tr.duration_ms) / AVG(tr.duration_ms), 0)
      ELSE 0
    END as cv
  FROM test_results tr
  JOIN test_executions te ON tr.execution_id = te.id
  WHERE te.organization_id = ${organizationId}
    AND tr.status = 'passed'
    ${dateFilter}
    ${extraFilters}
  GROUP BY tr.test_name, tr.file
  HAVING COUNT(*) > 1  -- Only tests with multiple runs
)
```

### Edge Cases Handled
- **Tests with only 1 run**: Excluded from calculation (can't measure stability)
- **No tests with multiple runs**: Defaults to CV = 0 (100% stable)
- **Tests with 0 avg duration**: Returns CV = 0

## Reliability Score Formula

```
Score = (PassRate × 0.4) + ((100 - FlakyRate) × 0.3) + (DurationStability × 0.3)
```

Where:
- **Pass Rate Contribution**: Up to 40 points
- **Flakiness Contribution**: Up to 30 points (0% flaky = 30 points)
- **Duration Stability Contribution**: Up to 30 points (0 CV = 30 points)

Duration Stability percentage: `(1 - min(CV, 1)) × 100`

## Verification

### Single-Run Scenario
1. Select branch/suite filter
2. `lastRunOnly=true` is passed to API
3. `effectiveDurationCV = 0`
4. Stability shows 100%, contribution = +30

### Multi-Run Scenario
1. View historic data (7 days)
2. Per-test CV calculated for tests with 2+ runs
3. Average CV represents overall stability
4. Stability reflects actual test duration consistency across runs

## Related Files Modified

- `lib/db/metrics.ts` - Updated SQL with per-test CV calculation
