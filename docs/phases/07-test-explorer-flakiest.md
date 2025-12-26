# Phase 07: Test Explorer - Flakiest Tests

> **Priority:** Medium | **Complexity:** Low | **Dependencies:** Phase 03 (Flaky Test Detection), Phase 06 (Explorer Page)
>
> Add flakiest tests view to the Test Explorer.

---

## Objective

1. Enable "Flakiest" tab in Test Explorer
2. Display tests ranked by flakiness rate
3. Show flaky run history and trends
4. Link to flakiness history data from Phase 03

---

## Prerequisites

- Phase 03 completed (test_flakiness_history table exists)
- Phase 06 completed (Explorer page exists)

---

## Database Changes

**No database migrations required** - uses test_flakiness_history from Phase 03.

---

## Backend Implementation

### 1. Update Types (`lib/types.ts`)

```typescript
// Flaky test explorer result (extends TestFlakinessHistory)
export interface FlakyTestExplorerResult {
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
  trend: "improving" | "degrading" | "stable";
  flakiness_volume: number; // flakiness_rate × total_runs / 100
}
```

### 2. Add Flakiest Tests Function (`lib/db.ts`)

```typescript
// Get flakiest tests for explorer
export async function getFlakiestTestsForExplorer(
  limit: number = 20,
  minRuns: number = 5,
  dateFrom?: string,
  dateTo?: string
): Promise<FlakyTestExplorerResult[]> {
  const sql = getSql();

  // Calculate flakiness from raw data if date filter applied
  if (dateFrom || dateTo) {
    const results = await sql`
      WITH flaky_stats AS (
        SELECT
          COALESCE(test_signature, MD5(test_file || '::' || test_name)) as test_signature,
          test_name,
          test_file,
          COUNT(*) as total_runs,
          COUNT(*) FILTER (WHERE retry_count > 0 AND status = 'passed') as flaky_runs,
          COUNT(*) FILTER (WHERE status = 'passed') as passed_runs,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_runs,
          ROUND(AVG(duration_ms)) as avg_duration_ms,
          MAX(started_at) FILTER (WHERE retry_count > 0 AND status = 'passed') as last_flaky_at,
          MAX(started_at) FILTER (WHERE status = 'passed') as last_passed_at,
          MAX(started_at) FILTER (WHERE status = 'failed') as last_failed_at
        FROM test_results
        WHERE
          (${dateFrom || null}::text IS NULL OR started_at >= ${dateFrom}::timestamptz)
          AND (${dateTo || null}::text IS NULL OR started_at <= ${dateTo}::timestamptz)
        GROUP BY test_name, test_file, test_signature
        HAVING COUNT(*) >= ${minRuns}
      )
      SELECT
        *,
        CASE
          WHEN passed_runs > 0
          THEN ROUND(flaky_runs::decimal / passed_runs * 100, 2)
          ELSE 0
        END as flakiness_rate
      FROM flaky_stats
      WHERE flaky_runs > 0
      ORDER BY flakiness_rate DESC, flaky_runs DESC
      LIMIT ${limit}
    `;

    return results.map((r) => ({
      test_signature: r.test_signature,
      test_name: r.test_name,
      test_file: r.test_file,
      total_runs: Number(r.total_runs),
      flaky_runs: Number(r.flaky_runs),
      passed_runs: Number(r.passed_runs),
      failed_runs: Number(r.failed_runs),
      flakiness_rate: Number(r.flakiness_rate),
      avg_duration_ms: Number(r.avg_duration_ms),
      last_flaky_at: r.last_flaky_at,
      last_passed_at: r.last_passed_at,
      last_failed_at: r.last_failed_at,
      trend: "stable" as const, // Can't calculate trend with filtered data
      flakiness_volume: Number(r.flakiness_rate) * Number(r.total_runs) / 100,
    }));
  }

  // Use pre-calculated data from test_flakiness_history
  const results = await sql`
    WITH recent_flakiness AS (
      SELECT
        COALESCE(test_signature, MD5(test_file || '::' || test_name)) as test_signature,
        COUNT(*) FILTER (WHERE retry_count > 0 AND status = 'passed') as recent_flaky
      FROM test_results
      WHERE started_at > NOW() - INTERVAL '7 days'
      GROUP BY test_name, test_file, test_signature
    ),
    older_flakiness AS (
      SELECT
        COALESCE(test_signature, MD5(test_file || '::' || test_name)) as test_signature,
        COUNT(*) FILTER (WHERE retry_count > 0 AND status = 'passed') as older_flaky
      FROM test_results
      WHERE started_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
      GROUP BY test_name, test_file, test_signature
    )
    SELECT
      tfh.*,
      CASE
        WHEN rf.recent_flaky IS NULL OR of.older_flaky IS NULL THEN 'stable'
        WHEN rf.recent_flaky < of.older_flaky THEN 'improving'
        WHEN rf.recent_flaky > of.older_flaky THEN 'degrading'
        ELSE 'stable'
      END as trend
    FROM test_flakiness_history tfh
    LEFT JOIN recent_flakiness rf ON tfh.test_signature = rf.test_signature
    LEFT JOIN older_flakiness of ON tfh.test_signature = of.test_signature
    WHERE tfh.total_runs >= ${minRuns}
      AND tfh.flaky_runs > 0
    ORDER BY tfh.flakiness_rate DESC, tfh.flaky_runs DESC
    LIMIT ${limit}
  `;

  return results.map((r) => ({
    test_signature: r.test_signature,
    test_name: r.test_name,
    test_file: r.test_file,
    total_runs: Number(r.total_runs),
    flaky_runs: Number(r.flaky_runs),
    passed_runs: Number(r.passed_runs),
    failed_runs: Number(r.failed_runs),
    flakiness_rate: Number(r.flakiness_rate),
    avg_duration_ms: Number(r.avg_duration_ms),
    last_flaky_at: r.last_flaky_at,
    last_passed_at: r.last_passed_at,
    last_failed_at: r.last_failed_at,
    trend: r.trend as "improving" | "degrading" | "stable",
    flakiness_volume: Number(r.flakiness_rate) * Number(r.total_runs) / 100,
  }));
}
```

### 3. Create Flakiest API (`app/api/explorer/flakiest/route.ts`)

```typescript
import { getFlakiestTestsForExplorer } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const minRuns = parseInt(searchParams.get("minRuns") || "5");
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    const tests = await getFlakiestTestsForExplorer(limit, minRuns, dateFrom, dateTo);

    return NextResponse.json({ tests });
  } catch (error) {
    console.error("Error fetching flakiest tests:", error);
    return NextResponse.json(
      { error: "Failed to fetch flakiest tests" },
      { status: 500 }
    );
  }
}
```

---

## Frontend Implementation

### 1. Create Flakiest Tests Table (`components/explorer/flakiest-tests-table.tsx`)

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  FileCode,
  Clock,
} from "lucide-react";

interface FlakyTestExplorerResult {
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
  trend: "improving" | "degrading" | "stable";
  flakiness_volume: number;
}

interface FlakiestTestsTableProps {
  dateFrom?: string;
  dateTo?: string;
}

export function FlakiestTestsTable({ dateFrom, dateTo }: FlakiestTestsTableProps) {
  const [tests, setTests] = useState<FlakyTestExplorerResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        const response = await fetch(`/api/explorer/flakiest?${params.toString()}`);
        const data = await response.json();
        setTests(data.tests || []);
      } catch (error) {
        console.error("Failed to fetch flakiest tests:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [dateFrom, dateTo]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving":
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      case "degrading":
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getFlakinessColor = (rate: number) => {
    if (rate >= 50) return "text-red-600";
    if (rate >= 25) return "text-orange-500";
    if (rate >= 10) return "text-amber-500";
    return "text-yellow-500";
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-green-500 mb-4" />
          <p className="text-lg font-medium">No flaky tests detected!</p>
          <p className="text-muted-foreground">
            Your test suite appears to be stable.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Flakiest Tests
          <Badge variant="secondary" className="ml-2">
            {tests.length} tests
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[35%]">Test</TableHead>
              <TableHead className="text-right">Flakiness Rate</TableHead>
              <TableHead className="text-right">Flaky / Total</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead className="text-right">Last Flaky</TableHead>
              <TableHead className="text-center">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tests.map((test, index) => (
              <TableRow key={test.test_signature}>
                <TableCell>
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground text-sm font-mono">
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{test.test_name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileCode className="h-3 w-3" />
                        <span className="truncate">{test.test_file}</span>
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(test.avg_duration_ms)} avg
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="space-y-1">
                    <span className={`text-lg font-semibold ${getFlakinessColor(test.flakiness_rate)}`}>
                      {test.flakiness_rate.toFixed(1)}%
                    </span>
                    <Progress
                      value={test.flakiness_rate}
                      className="h-1.5 w-16 ml-auto"
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <span className="text-amber-500">{test.flaky_runs}</span>
                  <span className="text-muted-foreground"> / {test.total_runs}</span>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className="font-mono">
                    {test.flakiness_volume.toFixed(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatTimeAgo(test.last_flaky_at)}
                </TableCell>
                <TableCell className="text-center">
                  {getTrendIcon(test.trend)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

### 2. Install Progress Component

```bash
npx shadcn@latest add progress
```

### 3. Update Explorer Page (`app/explorer/page.tsx`)

Enable the flakiest tab:

```tsx
import { FlakiestTestsTable } from "@/components/explorer/flakiest-tests-table";

// Update TabsTrigger to remove disabled:
<TabsTrigger value="flakiest" className="gap-2">
  <AlertTriangle className="h-4 w-4" />
  Flakiest
</TabsTrigger>

// Update TabsContent:
<TabsContent value="flakiest">
  <Suspense fallback={<TableSkeleton />}>
    <FlakiestTestsTable dateFrom={dateFrom} dateTo={dateTo} />
  </Suspense>
</TabsContent>
```

---

## API Specification

### GET /api/explorer/flakiest

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 20 | Max tests to return |
| minRuns | number | 5 | Minimum runs for inclusion |
| dateFrom | string | - | Start date (ISO 8601) |
| dateTo | string | - | End date (ISO 8601) |

**Response:**
```json
{
  "tests": [
    {
      "test_signature": "abc123...",
      "test_name": "should handle network timeout",
      "test_file": "tests/network.spec.ts",
      "total_runs": 100,
      "flaky_runs": 25,
      "passed_runs": 90,
      "failed_runs": 10,
      "flakiness_rate": 27.78,
      "avg_duration_ms": 5000,
      "last_flaky_at": "2025-12-24T15:30:00Z",
      "last_passed_at": "2025-12-25T10:00:00Z",
      "last_failed_at": "2025-12-23T08:00:00Z",
      "trend": "degrading",
      "flakiness_volume": 27.78
    }
  ]
}
```

---

## Testing Checklist

- [ ] Flakiest tab enabled in Explorer
- [ ] Tests sorted by flakiness rate (highest first)
- [ ] Flakiness rate calculates correctly
- [ ] Volume metric shows rate × runs
- [ ] Progress bar reflects flakiness rate
- [ ] Trend calculation works
- [ ] Date filter applies correctly
- [ ] Empty state shows positive message
- [ ] Time ago format works correctly

---

## Files to Create/Modify

### Create:
- `app/api/explorer/flakiest/route.ts`
- `components/explorer/flakiest-tests-table.tsx`

### Modify:
- `lib/types.ts` - Add FlakyTestExplorerResult
- `lib/db.ts` - Add getFlakiestTestsForExplorer
- `app/explorer/page.tsx` - Enable flakiest tab

### Install:
```bash
npx shadcn@latest add progress
```

---

*Phase 07 Complete → Proceed to Phase 08: Test Explorer - Most Failing*
