# Phase 08: Test Explorer - Most Failing Tests

> **Priority:** Medium | **Complexity:** Low | **Dependencies:** Phase 04 (Failure Rate), Phase 06 (Explorer Page)
>
> Add most failing tests view to the Test Explorer.

---

## Objective

1. Enable "Most Failing" tab in Test Explorer
2. Display tests ranked by failure rate
3. Show failure patterns and trends
4. Link to error pattern data from Phase 05

---

## Prerequisites

- Phase 04 completed (failure rate metrics)
- Phase 06 completed (Explorer page exists)

---

## Database Changes

**No database migrations required** - uses existing data with aggregation queries.

---

## Backend Implementation

### 1. Update Types (`lib/types.ts`)

```typescript
// Failing test explorer result
export interface FailingTestExplorerResult {
  test_signature: string;
  test_name: string;
  test_file: string;
  total_runs: number;
  passed_runs: number;
  failed_runs: number;
  skipped_runs: number;
  failure_rate: number;
  avg_duration_ms: number;
  last_failure_at: string | null;
  last_passed_at: string | null;
  last_error_message: string | null;
  error_pattern_hash: string | null;
  trend: "improving" | "degrading" | "stable";
  failure_volume: number; // failure_rate × total_runs / 100
}
```

### 2. Add Most Failing Function (`lib/db.ts`)

```typescript
// Get most failing tests for explorer
export async function getMostFailingTests(
  limit: number = 20,
  minRuns: number = 3,
  dateFrom?: string,
  dateTo?: string
): Promise<FailingTestExplorerResult[]> {
  const sql = getSql();

  const results = await sql`
    WITH test_stats AS (
      SELECT
        COALESCE(test_signature, MD5(test_file || '::' || test_name)) as test_signature,
        test_name,
        test_file,
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE status = 'passed') as passed_runs,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_runs,
        COUNT(*) FILTER (WHERE status = 'skipped') as skipped_runs,
        ROUND(AVG(duration_ms)) as avg_duration_ms,
        MAX(started_at) FILTER (WHERE status = 'failed') as last_failure_at,
        MAX(started_at) FILTER (WHERE status = 'passed') as last_passed_at
      FROM test_results
      WHERE
        (${dateFrom || null}::text IS NULL OR started_at >= ${dateFrom}::timestamptz)
        AND (${dateTo || null}::text IS NULL OR started_at <= ${dateTo}::timestamptz)
      GROUP BY test_name, test_file, test_signature
      HAVING COUNT(*) >= ${minRuns}
    ),
    last_error AS (
      SELECT DISTINCT ON (COALESCE(test_signature, MD5(test_file || '::' || test_name)))
        COALESCE(test_signature, MD5(test_file || '::' || test_name)) as test_signature,
        error_message as last_error_message,
        error_pattern_hash
      FROM test_results
      WHERE status = 'failed' AND error_message IS NOT NULL
      ORDER BY COALESCE(test_signature, MD5(test_file || '::' || test_name)), started_at DESC
    ),
    recent_failures AS (
      SELECT
        COALESCE(test_signature, MD5(test_file || '::' || test_name)) as test_signature,
        COUNT(*) FILTER (WHERE status = 'failed') as recent_failed
      FROM test_results
      WHERE started_at > NOW() - INTERVAL '7 days'
      GROUP BY test_name, test_file, test_signature
    ),
    older_failures AS (
      SELECT
        COALESCE(test_signature, MD5(test_file || '::' || test_name)) as test_signature,
        COUNT(*) FILTER (WHERE status = 'failed') as older_failed
      FROM test_results
      WHERE started_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
      GROUP BY test_name, test_file, test_signature
    )
    SELECT
      ts.*,
      CASE
        WHEN ts.total_runs > 0
        THEN ROUND(ts.failed_runs::decimal / ts.total_runs * 100, 2)
        ELSE 0
      END as failure_rate,
      le.last_error_message,
      le.error_pattern_hash,
      CASE
        WHEN rf.recent_failed IS NULL OR of.older_failed IS NULL THEN 'stable'
        WHEN rf.recent_failed < of.older_failed THEN 'improving'
        WHEN rf.recent_failed > of.older_failed THEN 'degrading'
        ELSE 'stable'
      END as trend
    FROM test_stats ts
    LEFT JOIN last_error le ON ts.test_signature = le.test_signature
    LEFT JOIN recent_failures rf ON ts.test_signature = rf.test_signature
    LEFT JOIN older_failures of ON ts.test_signature = of.test_signature
    WHERE ts.failed_runs > 0
    ORDER BY failure_rate DESC, ts.failed_runs DESC
    LIMIT ${limit}
  `;

  return results.map((r) => ({
    test_signature: r.test_signature,
    test_name: r.test_name,
    test_file: r.test_file,
    total_runs: Number(r.total_runs),
    passed_runs: Number(r.passed_runs),
    failed_runs: Number(r.failed_runs),
    skipped_runs: Number(r.skipped_runs),
    failure_rate: Number(r.failure_rate),
    avg_duration_ms: Number(r.avg_duration_ms),
    last_failure_at: r.last_failure_at,
    last_passed_at: r.last_passed_at,
    last_error_message: r.last_error_message,
    error_pattern_hash: r.error_pattern_hash,
    trend: r.trend as "improving" | "degrading" | "stable",
    failure_volume: Number(r.failure_rate) * Number(r.total_runs) / 100,
  }));
}
```

### 3. Create Most Failing API (`app/api/explorer/failing/route.ts`)

```typescript
import { getMostFailingTests } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const minRuns = parseInt(searchParams.get("minRuns") || "3");
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    const tests = await getMostFailingTests(limit, minRuns, dateFrom, dateTo);

    return NextResponse.json({ tests });
  } catch (error) {
    console.error("Error fetching failing tests:", error);
    return NextResponse.json(
      { error: "Failed to fetch failing tests" },
      { status: 500 }
    );
  }
}
```

---

## Frontend Implementation

### 1. Create Most Failing Tests Table (`components/explorer/failing-tests-table.tsx`)

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
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  FileCode,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FailingTestExplorerResult {
  test_signature: string;
  test_name: string;
  test_file: string;
  total_runs: number;
  passed_runs: number;
  failed_runs: number;
  failure_rate: number;
  avg_duration_ms: number;
  last_failure_at: string | null;
  last_passed_at: string | null;
  last_error_message: string | null;
  error_pattern_hash: string | null;
  trend: "improving" | "degrading" | "stable";
  failure_volume: number;
}

interface FailingTestsTableProps {
  dateFrom?: string;
  dateTo?: string;
}

export function FailingTestsTable({ dateFrom, dateTo }: FailingTestsTableProps) {
  const [tests, setTests] = useState<FailingTestExplorerResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        const response = await fetch(`/api/explorer/failing?${params.toString()}`);
        const data = await response.json();
        setTests(data.tests || []);
      } catch (error) {
        console.error("Failed to fetch failing tests:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [dateFrom, dateTo]);

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

  const getFailureRateColor = (rate: number) => {
    if (rate >= 75) return "text-red-600";
    if (rate >= 50) return "text-red-500";
    if (rate >= 25) return "text-orange-500";
    return "text-amber-500";
  };

  const getFailureRateBadge = (rate: number) => {
    if (rate >= 75) return { label: "Critical", variant: "destructive" as const };
    if (rate >= 50) return { label: "High", variant: "destructive" as const };
    if (rate >= 25) return { label: "Medium", variant: "secondary" as const };
    return { label: "Low", variant: "outline" as const };
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
          <p className="text-lg font-medium">All tests passing!</p>
          <p className="text-muted-foreground">
            No consistently failing tests detected.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-red-500" />
          Most Failing Tests
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
              <TableHead className="text-right">Failure Rate</TableHead>
              <TableHead className="text-right">Failed / Total</TableHead>
              <TableHead className="text-right">Volume</TableHead>
              <TableHead className="text-right">Last Failure</TableHead>
              <TableHead className="text-center">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tests.map((test, index) => {
              const severityBadge = getFailureRateBadge(test.failure_rate);

              return (
                <TableRow key={test.test_signature}>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground text-sm font-mono">
                        #{index + 1}
                      </span>
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium truncate">{test.test_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <FileCode className="h-3 w-3" />
                          <span className="truncate">{test.test_file}</span>
                        </p>
                        {test.last_error_message && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="text-xs text-red-500 truncate max-w-[200px] flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                                  {test.last_error_message.substring(0, 50)}...
                                </p>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md">
                                <pre className="text-xs whitespace-pre-wrap">
                                  {test.last_error_message}
                                </pre>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="space-y-1">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`text-lg font-semibold ${getFailureRateColor(test.failure_rate)}`}>
                          {test.failure_rate.toFixed(1)}%
                        </span>
                        <Badge variant={severityBadge.variant} className="text-xs">
                          {severityBadge.label}
                        </Badge>
                      </div>
                      <Progress
                        value={test.failure_rate}
                        className="h-1.5 w-20 ml-auto"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className="text-red-500">{test.failed_runs}</span>
                    <span className="text-muted-foreground"> / {test.total_runs}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="font-mono">
                      {test.failure_volume.toFixed(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm">
                      <p className="text-red-500">{formatTimeAgo(test.last_failure_at)}</p>
                      {test.last_passed_at && (
                        <p className="text-xs text-muted-foreground">
                          Passed: {formatTimeAgo(test.last_passed_at)}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {getTrendIcon(test.trend)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

### 2. Update Explorer Page (`app/explorer/page.tsx`)

Enable the failing tab:

```tsx
import { FailingTestsTable } from "@/components/explorer/failing-tests-table";

// Update TabsTrigger to remove disabled:
<TabsTrigger value="failing" className="gap-2">
  <XCircle className="h-4 w-4" />
  Most Failing
</TabsTrigger>

// Update TabsContent:
<TabsContent value="failing">
  <Suspense fallback={<TableSkeleton />}>
    <FailingTestsTable dateFrom={dateFrom} dateTo={dateTo} />
  </Suspense>
</TabsContent>
```

---

## API Specification

### GET /api/explorer/failing

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
      "test_name": "should validate payment",
      "test_file": "tests/payment.spec.ts",
      "total_runs": 50,
      "passed_runs": 15,
      "failed_runs": 35,
      "skipped_runs": 0,
      "failure_rate": 70.0,
      "avg_duration_ms": 8000,
      "last_failure_at": "2025-12-25T09:30:00Z",
      "last_passed_at": "2025-12-24T10:00:00Z",
      "last_error_message": "AssertionError: expected 200 to equal 500",
      "error_pattern_hash": "def456...",
      "trend": "stable",
      "failure_volume": 35.0
    }
  ]
}
```

---

## Testing Checklist

- [ ] Most Failing tab enabled in Explorer
- [ ] Tests sorted by failure rate (highest first)
- [ ] Failure rate calculates correctly
- [ ] Severity badges show correct level
- [ ] Last error message shows in tooltip
- [ ] Error pattern hash links to pattern (if Phase 05 done)
- [ ] Trend calculation works
- [ ] Date filter applies correctly
- [ ] Empty state shows positive message

---

## Files to Create/Modify

### Create:
- `app/api/explorer/failing/route.ts`
- `components/explorer/failing-tests-table.tsx`

### Modify:
- `lib/types.ts` - Add FailingTestExplorerResult
- `lib/db.ts` - Add getMostFailingTests
- `app/explorer/page.tsx` - Enable failing tab

---

*Phase 08 Complete → Proceed to Phase 09: AI Failure Categorization*
