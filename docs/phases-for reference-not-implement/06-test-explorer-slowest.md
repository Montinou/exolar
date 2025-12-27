# Phase 06: Test Explorer - Slowest Tests

> **Priority:** Medium | **Complexity:** Low | **Dependencies:** Phase 01 (Test Signatures)
>
> New page to explore and analyze slowest tests for optimization.

---

## Objective

1. Create new /explorer page with tabbed navigation
2. Implement "Slowest Tests" view
3. Show duration metrics and trends
4. Enable sorting and filtering

---

## Prerequisites

- Phase 01 completed (test signatures exist)
- Basic dashboard implementation complete

---

## Database Changes

**No database migrations required** - uses existing data with aggregation queries.

---

## Backend Implementation

### 1. Add Types (`lib/types.ts`)

```typescript
// Test explorer result
export interface TestExplorerResult {
  test_signature: string;
  test_name: string;
  test_file: string;
  total_runs: number;
  avg_duration_ms: number;
  min_duration_ms: number;
  max_duration_ms: number;
  p95_duration_ms: number;
  last_run: string;
  last_status: string;
  trend: "improving" | "degrading" | "stable";
}
```

### 2. Add Explorer Functions (`lib/db.ts`)

```typescript
// Get slowest tests
export async function getSlowestTests(
  limit: number = 20,
  minRuns: number = 3,
  dateFrom?: string,
  dateTo?: string
): Promise<TestExplorerResult[]> {
  const sql = getSql();

  const results = await sql`
    WITH test_stats AS (
      SELECT
        COALESCE(test_signature, MD5(test_file || '::' || test_name)) as test_signature,
        test_name,
        test_file,
        COUNT(*) as total_runs,
        AVG(duration_ms) as avg_duration_ms,
        MIN(duration_ms) as min_duration_ms,
        MAX(duration_ms) as max_duration_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration_ms,
        MAX(started_at) as last_run
      FROM test_results
      WHERE
        (${dateFrom || null}::text IS NULL OR started_at >= ${dateFrom}::timestamptz)
        AND (${dateTo || null}::text IS NULL OR started_at <= ${dateTo}::timestamptz)
      GROUP BY test_name, test_file, test_signature
      HAVING COUNT(*) >= ${minRuns}
    ),
    last_status AS (
      SELECT DISTINCT ON (COALESCE(test_signature, MD5(test_file || '::' || test_name)))
        COALESCE(test_signature, MD5(test_file || '::' || test_name)) as test_signature,
        status as last_status
      FROM test_results
      ORDER BY COALESCE(test_signature, MD5(test_file || '::' || test_name)), started_at DESC
    ),
    recent_avg AS (
      SELECT
        COALESCE(test_signature, MD5(test_file || '::' || test_name)) as test_signature,
        AVG(duration_ms) as recent_avg
      FROM test_results
      WHERE started_at > NOW() - INTERVAL '7 days'
      GROUP BY test_name, test_file, test_signature
    ),
    older_avg AS (
      SELECT
        COALESCE(test_signature, MD5(test_file || '::' || test_name)) as test_signature,
        AVG(duration_ms) as older_avg
      FROM test_results
      WHERE started_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
      GROUP BY test_name, test_file, test_signature
    )
    SELECT
      ts.*,
      ls.last_status,
      CASE
        WHEN ra.recent_avg IS NULL OR oa.older_avg IS NULL THEN 'stable'
        WHEN ra.recent_avg < oa.older_avg * 0.9 THEN 'improving'
        WHEN ra.recent_avg > oa.older_avg * 1.1 THEN 'degrading'
        ELSE 'stable'
      END as trend
    FROM test_stats ts
    LEFT JOIN last_status ls ON ts.test_signature = ls.test_signature
    LEFT JOIN recent_avg ra ON ts.test_signature = ra.test_signature
    LEFT JOIN older_avg oa ON ts.test_signature = oa.test_signature
    ORDER BY ts.avg_duration_ms DESC
    LIMIT ${limit}
  `;

  return results.map((r) => ({
    test_signature: r.test_signature,
    test_name: r.test_name,
    test_file: r.test_file,
    total_runs: Number(r.total_runs),
    avg_duration_ms: Number(r.avg_duration_ms),
    min_duration_ms: Number(r.min_duration_ms),
    max_duration_ms: Number(r.max_duration_ms),
    p95_duration_ms: Number(r.p95_duration_ms),
    last_run: r.last_run,
    last_status: r.last_status,
    trend: r.trend as "improving" | "degrading" | "stable",
  }));
}
```

### 3. Create Explorer API (`app/api/explorer/slowest/route.ts`)

```typescript
import { getSlowestTests } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const minRuns = parseInt(searchParams.get("minRuns") || "3");
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    const tests = await getSlowestTests(limit, minRuns, dateFrom, dateTo);

    return NextResponse.json({ tests });
  } catch (error) {
    console.error("Error fetching slowest tests:", error);
    return NextResponse.json(
      { error: "Failed to fetch slowest tests" },
      { status: 500 }
    );
  }
}
```

---

## Frontend Implementation

### 1. Create Explorer Page (`app/explorer/page.tsx`)

```tsx
import { Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SlowestTestsTable } from "@/components/explorer/slowest-tests-table";
import { ExplorerFilters } from "@/components/explorer/explorer-filters";
import { Clock, AlertTriangle, XCircle } from "lucide-react";

export default async function ExplorerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const tab = (params.tab as string) || "slowest";
  const dateFrom = params.dateFrom as string | undefined;
  const dateTo = params.dateTo as string | undefined;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Test Explorer</h1>
          <p className="text-muted-foreground">
            Analyze test performance and reliability
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <ExplorerFilters />
        </div>

        <Tabs defaultValue={tab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="slowest" className="gap-2">
              <Clock className="h-4 w-4" />
              Slowest
            </TabsTrigger>
            <TabsTrigger value="flakiest" className="gap-2" disabled>
              <AlertTriangle className="h-4 w-4" />
              Flakiest
            </TabsTrigger>
            <TabsTrigger value="failing" className="gap-2" disabled>
              <XCircle className="h-4 w-4" />
              Most Failing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="slowest">
            <Suspense fallback={<TableSkeleton />}>
              <SlowestTestsTable dateFrom={dateFrom} dateTo={dateTo} />
            </Suspense>
          </TabsContent>

          <TabsContent value="flakiest">
            <p className="text-muted-foreground">Coming in Phase 07</p>
          </TabsContent>

          <TabsContent value="failing">
            <p className="text-muted-foreground">Coming in Phase 08</p>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-10 bg-muted animate-pulse rounded" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-muted animate-pulse rounded" />
      ))}
    </div>
  );
}
```

### 2. Create Explorer Filters (`components/explorer/explorer-filters.tsx`)

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { Button } from "@/components/ui/button";

export function ExplorerFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get("dateFrom");
    const to = searchParams.get("dateTo");
    if (from && to) {
      return { from: new Date(from), to: new Date(to) };
    }
    return undefined;
  });

  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => {
      setDateRange(range);
      const params = new URLSearchParams(searchParams.toString());

      if (range?.from) {
        params.set("dateFrom", range.from.toISOString());
      } else {
        params.delete("dateFrom");
      }

      if (range?.to) {
        params.set("dateTo", range.to.toISOString());
      } else {
        params.delete("dateTo");
      }

      router.push(`/explorer?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearFilters = () => {
    setDateRange(undefined);
    router.push("/explorer");
  };

  return (
    <div className="flex items-center gap-4">
      <DateRangePicker
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
      />
      {dateRange && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear
        </Button>
      )}
    </div>
  );
}
```

### 3. Create Slowest Tests Table (`components/explorer/slowest-tests-table.tsx`)

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
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  FileCode,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface TestExplorerResult {
  test_signature: string;
  test_name: string;
  test_file: string;
  total_runs: number;
  avg_duration_ms: number;
  min_duration_ms: number;
  max_duration_ms: number;
  p95_duration_ms: number;
  last_run: string;
  last_status: string;
  trend: "improving" | "degrading" | "stable";
}

interface SlowestTestsTableProps {
  dateFrom?: string;
  dateTo?: string;
}

export function SlowestTestsTable({ dateFrom, dateTo }: SlowestTestsTableProps) {
  const [tests, setTests] = useState<TestExplorerResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        const response = await fetch(`/api/explorer/slowest?${params.toString()}`);
        const data = await response.json();
        setTests(data.tests || []);
      } catch (error) {
        console.error("Failed to fetch slowest tests:", error);
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
        <CardContent className="py-10 text-center text-muted-foreground">
          No tests found with enough runs for analysis.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Slowest Tests
          <Badge variant="secondary" className="ml-2">
            {tests.length} tests
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Test</TableHead>
              <TableHead className="text-right">Avg Duration</TableHead>
              <TableHead className="text-right">P95</TableHead>
              <TableHead className="text-right">Min/Max</TableHead>
              <TableHead className="text-right">Runs</TableHead>
              <TableHead className="text-center">Trend</TableHead>
              <TableHead className="text-center">Status</TableHead>
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
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <span className="text-lg font-semibold">
                    {formatDuration(test.avg_duration_ms)}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatDuration(test.p95_duration_ms)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {formatDuration(test.min_duration_ms)} /{" "}
                  {formatDuration(test.max_duration_ms)}
                </TableCell>
                <TableCell className="text-right">
                  {test.total_runs}
                </TableCell>
                <TableCell className="text-center">
                  {getTrendIcon(test.trend)}
                </TableCell>
                <TableCell className="text-center">
                  {test.last_status === "passed" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 inline" />
                  )}
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

### 4. Add Navigation Link to Dashboard

Update `app/page.tsx` header:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";

// In header section:
<div className="flex items-center gap-4">
  <Link href="/explorer">
    <Button variant="outline" size="sm" className="gap-2">
      <BarChart3 className="h-4 w-4" />
      Explorer
    </Button>
  </Link>
  <SearchTests onSelectTest={(sig) => console.log("Selected:", sig)} />
  <UserMenu />
</div>
```

---

## API Specification

### GET /api/explorer/slowest

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 20 | Max tests to return |
| minRuns | number | 3 | Minimum runs for inclusion |
| dateFrom | string | - | Start date (ISO 8601) |
| dateTo | string | - | End date (ISO 8601) |

**Response:**
```json
{
  "tests": [
    {
      "test_signature": "abc123...",
      "test_name": "should load large dashboard",
      "test_file": "tests/dashboard.spec.ts",
      "total_runs": 50,
      "avg_duration_ms": 45000,
      "min_duration_ms": 30000,
      "max_duration_ms": 65000,
      "p95_duration_ms": 58000,
      "last_run": "2025-12-25T10:30:00Z",
      "last_status": "passed",
      "trend": "degrading"
    }
  ]
}
```

---

## Testing Checklist

- [ ] Explorer page loads correctly
- [ ] Slowest tests tab shows data
- [ ] Tests sorted by avg duration (slowest first)
- [ ] Duration formatting correct (ms/s/m)
- [ ] P95 percentile calculated correctly
- [ ] Trend calculation works (improving/degrading/stable)
- [ ] Date filter applies correctly
- [ ] Empty state shows when no data
- [ ] Navigation from dashboard works

---

## Files to Create/Modify

### Create:
- `app/explorer/page.tsx`
- `app/api/explorer/slowest/route.ts`
- `components/explorer/explorer-filters.tsx`
- `components/explorer/slowest-tests-table.tsx`

### Modify:
- `lib/types.ts` - Add TestExplorerResult
- `lib/db.ts` - Add getSlowestTests
- `app/page.tsx` - Add navigation link to Explorer

---

*Phase 06 Complete → Proceed to Phase 07: Test Explorer - Flakiest*
