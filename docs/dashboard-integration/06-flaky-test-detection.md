# Phase 06: Flaky Test Detection

> **Priority:** High | **Complexity:** Medium | **Dependencies:** Phase 04 (Test Signatures)
>
> Automatically detect and track tests that pass intermittently, helping teams identify unreliable tests.

---

## Objective

1. Define flakiness criteria: `retry_count > 0 AND status = 'passed'`
2. Create tracking table for historical flakiness data
3. Add visual indicators for flaky tests in the UI
4. Calculate flakiness metrics per test

---

## Prerequisites

- Phase 04 complete (test_signature column exists)
- Test data with retry information

---

## Database Changes

### Migration Script: `scripts/003_flaky_test_detection.sql`

```sql
-- Add flaky indicator to test_results
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS is_flaky BOOLEAN DEFAULT false;

-- Create index for flaky tests
CREATE INDEX IF NOT EXISTS idx_test_results_flaky
  ON test_results(is_flaky) WHERE is_flaky = true;

-- Create flakiness history tracking table
CREATE TABLE IF NOT EXISTS test_flakiness_history (
  id SERIAL PRIMARY KEY,
  test_signature TEXT NOT NULL UNIQUE,
  test_name TEXT NOT NULL,
  test_file TEXT NOT NULL,
  total_runs INTEGER DEFAULT 0,
  flaky_runs INTEGER DEFAULT 0,
  passed_runs INTEGER DEFAULT 0,
  failed_runs INTEGER DEFAULT 0,
  flakiness_rate DECIMAL(5,2) DEFAULT 0,
  avg_duration_ms INTEGER DEFAULT 0,
  last_flaky_at TIMESTAMP WITH TIME ZONE,
  last_passed_at TIMESTAMP WITH TIME ZONE,
  last_failed_at TIMESTAMP WITH TIME ZONE,
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_flakiness_rate
  ON test_flakiness_history(flakiness_rate DESC);
CREATE INDEX IF NOT EXISTS idx_flakiness_flaky_runs
  ON test_flakiness_history(flaky_runs DESC);
CREATE INDEX IF NOT EXISTS idx_flakiness_updated
  ON test_flakiness_history(updated_at DESC);

-- Backfill is_flaky for existing records
UPDATE test_results
SET is_flaky = true
WHERE retry_count > 0 AND status = 'passed';

-- Backfill flakiness history from existing data
INSERT INTO test_flakiness_history (
  test_signature,
  test_name,
  test_file,
  total_runs,
  flaky_runs,
  passed_runs,
  failed_runs,
  flakiness_rate,
  avg_duration_ms,
  last_flaky_at,
  last_passed_at,
  last_failed_at,
  first_seen_at,
  updated_at
)
SELECT
  COALESCE(test_signature, MD5(test_file || '::' || test_name)) as test_signature,
  test_name,
  test_file,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE retry_count > 0 AND status = 'passed') as flaky_runs,
  COUNT(*) FILTER (WHERE status = 'passed') as passed_runs,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_runs,
  CASE
    WHEN COUNT(*) FILTER (WHERE status = 'passed') > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE retry_count > 0 AND status = 'passed')::decimal
      / COUNT(*) FILTER (WHERE status = 'passed') * 100, 2
    )
    ELSE 0
  END as flakiness_rate,
  ROUND(AVG(duration_ms)) as avg_duration_ms,
  MAX(started_at) FILTER (WHERE retry_count > 0 AND status = 'passed') as last_flaky_at,
  MAX(started_at) FILTER (WHERE status = 'passed') as last_passed_at,
  MAX(started_at) FILTER (WHERE status = 'failed') as last_failed_at,
  MIN(started_at) as first_seen_at,
  NOW() as updated_at
FROM test_results
GROUP BY test_name, test_file, test_signature
ON CONFLICT (test_signature) DO UPDATE SET
  total_runs = EXCLUDED.total_runs,
  flaky_runs = EXCLUDED.flaky_runs,
  passed_runs = EXCLUDED.passed_runs,
  failed_runs = EXCLUDED.failed_runs,
  flakiness_rate = EXCLUDED.flakiness_rate,
  avg_duration_ms = EXCLUDED.avg_duration_ms,
  last_flaky_at = EXCLUDED.last_flaky_at,
  last_passed_at = EXCLUDED.last_passed_at,
  last_failed_at = EXCLUDED.last_failed_at,
  updated_at = NOW();
```

---

## Backend Implementation

### 1. Add Types (`lib/types.ts`)

```typescript
// Add to TestResult interface
export interface TestResult {
  // ... existing fields
  is_flaky?: boolean;
}

// Flakiness tracking types
export interface TestFlakinessHistory {
  id: number;
  test_signature: string;
  test_name: string;
  test_file: string;
  total_runs: number;
  flaky_runs: number;
  passed_runs: number;
  failed_runs: number;
  flakiness_rate: number;
  avg_duration_ms: number;
  last_flaky_at: string | null;
  last_passed_at: string | null;
  last_failed_at: string | null;
  first_seen_at: string;
  updated_at: string;
}

export interface FlakinessSummary {
  total_flaky_tests: number;
  avg_flakiness_rate: number;
  most_flaky_tests: TestFlakinessHistory[];
}
```

### 2. Add Flakiness Functions (`lib/db.ts`)

```typescript
// Check if a test result is flaky
export function isTestFlaky(retryCount: number, status: string): boolean {
  return retryCount > 0 && status === 'passed';
}

// Get flakiest tests
export async function getFlakiestTests(
  limit: number = 10,
  minRuns: number = 5
): Promise<TestFlakinessHistory[]> {
  const sql = getSql();

  const results = await sql`
    SELECT *
    FROM test_flakiness_history
    WHERE total_runs >= ${minRuns}
      AND flaky_runs > 0
    ORDER BY flakiness_rate DESC, flaky_runs DESC
    LIMIT ${limit}
  `;

  return results as TestFlakinessHistory[];
}

// Get flakiness summary for dashboard
export async function getFlakinessSummary(): Promise<FlakinessSummary> {
  const sql = getSql();

  const summaryResult = await sql`
    SELECT
      COUNT(*) FILTER (WHERE flaky_runs > 0) as total_flaky_tests,
      COALESCE(AVG(flakiness_rate) FILTER (WHERE flaky_runs > 0), 0) as avg_flakiness_rate
    FROM test_flakiness_history
    WHERE total_runs >= 5
  `;

  const topFlaky = await getFlakiestTests(5);

  return {
    total_flaky_tests: Number(summaryResult[0].total_flaky_tests),
    avg_flakiness_rate: Number(summaryResult[0].avg_flakiness_rate),
    most_flaky_tests: topFlaky
  };
}

// Update flakiness history after test result insert
export async function updateFlakinessHistory(
  testSignature: string,
  testName: string,
  testFile: string,
  status: string,
  retryCount: number,
  durationMs: number
): Promise<void> {
  const sql = getSql();
  const isFlaky = isTestFlaky(retryCount, status);

  await sql`
    INSERT INTO test_flakiness_history (
      test_signature,
      test_name,
      test_file,
      total_runs,
      flaky_runs,
      passed_runs,
      failed_runs,
      flakiness_rate,
      avg_duration_ms,
      last_flaky_at,
      last_passed_at,
      last_failed_at,
      first_seen_at,
      updated_at
    ) VALUES (
      ${testSignature},
      ${testName},
      ${testFile},
      1,
      ${isFlaky ? 1 : 0},
      ${status === 'passed' ? 1 : 0},
      ${status === 'failed' ? 1 : 0},
      ${isFlaky ? 100 : 0},
      ${durationMs},
      ${isFlaky ? sql`NOW()` : null},
      ${status === 'passed' ? sql`NOW()` : null},
      ${status === 'failed' ? sql`NOW()` : null},
      NOW(),
      NOW()
    )
    ON CONFLICT (test_signature) DO UPDATE SET
      total_runs = test_flakiness_history.total_runs + 1,
      flaky_runs = test_flakiness_history.flaky_runs + ${isFlaky ? 1 : 0},
      passed_runs = test_flakiness_history.passed_runs + ${status === 'passed' ? 1 : 0},
      failed_runs = test_flakiness_history.failed_runs + ${status === 'failed' ? 1 : 0},
      flakiness_rate = CASE
        WHEN test_flakiness_history.passed_runs + ${status === 'passed' ? 1 : 0} > 0
        THEN ROUND(
          (test_flakiness_history.flaky_runs + ${isFlaky ? 1 : 0})::decimal
          / (test_flakiness_history.passed_runs + ${status === 'passed' ? 1 : 0}) * 100, 2
        )
        ELSE 0
      END,
      avg_duration_ms = ROUND(
        (test_flakiness_history.avg_duration_ms * test_flakiness_history.total_runs + ${durationMs})
        / (test_flakiness_history.total_runs + 1)
      ),
      last_flaky_at = CASE WHEN ${isFlaky} THEN NOW() ELSE test_flakiness_history.last_flaky_at END,
      last_passed_at = CASE WHEN ${status} = 'passed' THEN NOW() ELSE test_flakiness_history.last_passed_at END,
      last_failed_at = CASE WHEN ${status} = 'failed' THEN NOW() ELSE test_flakiness_history.last_failed_at END,
      updated_at = NOW()
  `;
}
```

### 3. Update Data Ingestion to Track Flakiness

Update `insertTestResults` in `lib/db.ts`:

```typescript
export async function insertTestResults(
  executionId: number,
  results: TestResultRequest[]
): Promise<number[]> {
  const sql = getSql();
  const insertedIds: number[] = [];

  for (const result of results) {
    const signature = generateTestSignature(result.test_file, result.test_name);
    const isFlaky = isTestFlaky(result.retry_count, result.status);

    const inserted = await sql`
      INSERT INTO test_results (
        execution_id,
        test_signature,
        test_name,
        test_file,
        status,
        duration_ms,
        is_critical,
        is_flaky,
        error_message,
        stack_trace,
        browser,
        retry_count,
        started_at,
        completed_at
      ) VALUES (
        ${executionId},
        ${signature},
        ${result.test_name},
        ${result.test_file},
        ${result.status},
        ${result.duration_ms},
        ${result.is_critical || false},
        ${isFlaky},
        ${result.error_message || null},
        ${result.stack_trace || null},
        ${result.browser},
        ${result.retry_count},
        ${result.started_at}::timestamptz,
        ${result.completed_at ? result.completed_at + '::timestamptz' : null}
      )
      RETURNING id
    `;

    insertedIds.push(inserted[0].id);

    // Update flakiness history
    await updateFlakinessHistory(
      signature,
      result.test_name,
      result.test_file,
      result.status,
      result.retry_count,
      result.duration_ms
    );
  }

  return insertedIds;
}
```

### 4. Create Flakiness API Route (`app/api/flakiness/route.ts`)

```typescript
import { getFlakinessSummary, getFlakiestTests } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const minRuns = parseInt(searchParams.get("minRuns") || "5");

    const [summary, flakiestTests] = await Promise.all([
      getFlakinessSummary(),
      getFlakiestTests(limit, minRuns)
    ]);

    return NextResponse.json({
      summary,
      tests: flakiestTests
    });
  } catch (error) {
    console.error("Error fetching flakiness data:", error);
    return NextResponse.json(
      { error: "Failed to fetch flakiness data" },
      { status: 500 }
    );
  }
}
```

---

## Frontend Implementation

### 1. Install Tooltip Component

```bash
npx shadcn@latest add tooltip
```

### 2. Create Flaky Badge (`components/dashboard/flaky-badge.tsx`)

```tsx
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle } from "lucide-react";

interface FlakyBadgeProps {
  flakinessRate?: number;
  flakyRuns?: number;
  totalRuns?: number;
  showTooltip?: boolean;
}

export function FlakyBadge({
  flakinessRate,
  flakyRuns,
  totalRuns,
  showTooltip = true,
}: FlakyBadgeProps) {
  if (!flakinessRate || flakinessRate === 0) {
    return null;
  }

  const badge = (
    <Badge
      variant="outline"
      className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1"
    >
      <AlertTriangle className="h-3 w-3" />
      Flaky {flakinessRate.toFixed(0)}%
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p>
            This test was flaky in {flakyRuns} of {totalRuns} runs
          </p>
          <p className="text-xs text-muted-foreground">
            Flaky = passed after retry
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

### 3. Create Flakiest Tests Card (`components/dashboard/flakiest-tests-card.tsx`)

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileCode, RefreshCw } from "lucide-react";
import { FlakyBadge } from "./flaky-badge";

interface TestFlakinessHistory {
  test_signature: string;
  test_name: string;
  test_file: string;
  total_runs: number;
  flaky_runs: number;
  flakiness_rate: number;
  last_flaky_at: string | null;
}

interface FlakinessSummary {
  total_flaky_tests: number;
  avg_flakiness_rate: number;
}

export function FlakiestTestsCard() {
  const [data, setData] = useState<{
    summary: FlakinessSummary;
    tests: TestFlakinessHistory[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/flakiness?limit=5");
        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Failed to fetch flakiness data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Flakiest Tests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.tests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Flakiest Tests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No flaky tests detected</p>
            <p className="text-xs">Great job keeping tests stable!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Flakiest Tests
          </span>
          <Badge variant="secondary">
            {data.summary.total_flaky_tests} flaky
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.tests.map((test) => (
            <div
              key={test.test_signature}
              className="flex items-start justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{test.test_name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileCode className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{test.test_file}</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <FlakyBadge
                  flakinessRate={test.flakiness_rate}
                  flakyRuns={test.flaky_runs}
                  totalRuns={test.total_runs}
                />
                <span className="text-xs text-muted-foreground">
                  {test.flaky_runs}/{test.total_runs} runs
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 4. Add to Dashboard (`app/page.tsx`)

```tsx
import { FlakiestTestsCard } from "@/components/dashboard/flakiest-tests-card";

// In the dashboard layout:
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2">
    <TrendChart data={trends} />
  </div>
  <FlakiestTestsCard />
</div>
```

---

## API Specification

### GET /api/flakiness

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 10 | Max tests to return |
| minRuns | number | 5 | Min runs to consider |

**Response:**
```json
{
  "summary": {
    "total_flaky_tests": 12,
    "avg_flakiness_rate": 15.5
  },
  "tests": [
    {
      "test_signature": "abc123...",
      "test_name": "should handle timeout gracefully",
      "test_file": "tests/network.spec.ts",
      "total_runs": 50,
      "flaky_runs": 8,
      "passed_runs": 45,
      "failed_runs": 5,
      "flakiness_rate": 17.78,
      "avg_duration_ms": 2500,
      "last_flaky_at": "2025-12-24T15:30:00Z"
    }
  ]
}
```

---

## Testing Checklist

- [ ] Migration script runs without errors
- [ ] Existing records get backfilled for is_flaky
- [ ] Flakiness history table populates correctly
- [ ] Flaky badge appears on tests with retries
- [ ] Flakiest tests card shows top 5 flaky tests
- [ ] Flakiness rate calculates correctly
- [ ] Tooltip shows correct information
- [ ] Empty state shows when no flaky tests
- [ ] Data ingestion updates flakiness history

---

## Files to Create/Modify

### Create:
- `scripts/003_flaky_test_detection.sql`
- `app/api/flakiness/route.ts`
- `components/dashboard/flaky-badge.tsx`
- `components/dashboard/flakiest-tests-card.tsx`

### Modify:
- `lib/types.ts` - Add flakiness interfaces
- `lib/db.ts` - Add flakiness functions, update insertTestResults
- `app/page.tsx` - Add FlakiestTestsCard

### Install:
```bash
npx shadcn@latest add tooltip
```

---

*Phase 06 Complete → Proceed to Phase 07: Failure Rate Metrics*
