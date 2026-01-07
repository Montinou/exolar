# Phase 05: Date Range Filter

> **Priority:** High | **Complexity:** Low | **Dependencies:** Foundation Phases
>
> Enables filtering all dashboard data by date range for historical analysis.

---

## Objective

1. Add date range picker component to the dashboard
2. Update all API routes to accept date parameters
3. Filter executions, metrics, and trends by selected date range
4. Persist filter state in URL for shareable links

---

## Prerequisites

- Foundation phases complete
- Test data in database with various dates

---

## Database Changes

**No database migrations required** - filtering uses existing `started_at` columns.

---

## Backend Implementation

### 1. Update Executions Query (`lib/db.ts`)

```typescript
export async function getExecutions(
  limit: number = 50,
  status?: string,
  branch?: string,
  dateFrom?: string,
  dateTo?: string
): Promise<TestExecution[]> {
  const sql = getSql();

  const results = await sql`
    SELECT * FROM test_executions
    WHERE
      (${status || null}::text IS NULL OR ${status} = 'all' OR status = ${status})
      AND (${branch || null}::text IS NULL OR ${branch} = 'all' OR branch = ${branch})
      AND (${dateFrom || null}::text IS NULL OR started_at >= ${dateFrom}::timestamptz)
      AND (${dateTo || null}::text IS NULL OR started_at <= ${dateTo}::timestamptz)
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;

  return results as TestExecution[];
}
```

### 2. Update Metrics Query (`lib/db.ts`)

```typescript
export async function getDashboardMetrics(
  dateFrom?: string,
  dateTo?: string
): Promise<DashboardMetrics> {
  const sql = getSql();

  const result = await sql`
    WITH filtered_executions AS (
      SELECT *
      FROM test_executions
      WHERE
        (${dateFrom || null}::text IS NULL OR started_at >= ${dateFrom}::timestamptz)
        AND (${dateTo || null}::text IS NULL OR started_at <= ${dateTo}::timestamptz)
    )
    SELECT
      COUNT(*) as total_executions,
      COALESCE(
        ROUND(AVG(CASE WHEN status = 'success' THEN 100.0 ELSE 0 END), 1)
      , 0) as pass_rate,
      COALESCE(
        ROUND(AVG(CASE WHEN status = 'failure' THEN 100.0 ELSE 0 END), 1)
      , 0) as failure_rate,
      COALESCE(ROUND(AVG(duration_ms)), 0) as avg_duration_ms,
      COUNT(*) FILTER (WHERE status = 'failure') as critical_failures,
      COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') as last_24h_executions
    FROM filtered_executions
  `;

  return {
    total_executions: Number(result[0].total_executions),
    pass_rate: Number(result[0].pass_rate),
    failure_rate: Number(result[0].failure_rate),
    avg_duration_ms: Number(result[0].avg_duration_ms),
    critical_failures: Number(result[0].critical_failures),
    last_24h_executions: Number(result[0].last_24h_executions),
    failure_volume: Number(result[0].failure_rate) * Number(result[0].total_executions) / 100,
  };
}
```

### 3. Update Trends Query (`lib/db.ts`)

```typescript
export async function getTrendData(
  days: number = 7,
  dateFrom?: string,
  dateTo?: string
): Promise<TrendData[]> {
  const sql = getSql();

  const results = await sql`
    SELECT
      DATE(tr.started_at) as date,
      COUNT(*) FILTER (WHERE tr.status = 'passed') as passed,
      COUNT(*) FILTER (WHERE tr.status = 'failed') as failed,
      COUNT(*) as total
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.status != 'running'
      AND (
        CASE
          WHEN ${dateFrom}::text IS NOT NULL AND ${dateTo}::text IS NOT NULL
          THEN tr.started_at >= ${dateFrom}::timestamptz AND tr.started_at <= ${dateTo}::timestamptz
          ELSE tr.started_at >= NOW() - (${days} || ' days')::interval
        END
      )
    GROUP BY DATE(tr.started_at)
    ORDER BY date ASC
  `;

  return results as TrendData[];
}
```

### 4. Update API Routes

#### `app/api/executions/route.ts`

```typescript
import { getExecutions, getBranches } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const branch = searchParams.get("branch") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50");
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    const [executions, branches] = await Promise.all([
      getExecutions(limit, status, branch, dateFrom, dateTo),
      getBranches()
    ]);

    return NextResponse.json({ executions, branches });
  } catch (error) {
    console.error("Error fetching executions:", error);
    return NextResponse.json(
      { error: "Failed to fetch executions" },
      { status: 500 }
    );
  }
}
```

#### `app/api/metrics/route.ts`

```typescript
import { getDashboardMetrics } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    const metrics = await getDashboardMetrics(dateFrom, dateTo);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Error fetching metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
```

#### `app/api/trends/route.ts`

```typescript
import { getTrendData } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "7");
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    const trends = await getTrendData(days, dateFrom, dateTo);

    return NextResponse.json(trends);
  } catch (error) {
    console.error("Error fetching trends:", error);
    return NextResponse.json(
      { error: "Failed to fetch trends" },
      { status: 500 }
    );
  }
}
```

---

## Frontend Implementation

### 1. Install Components

```bash
npx shadcn@latest add calendar popover
npm install date-fns react-day-picker
```

### 2. Create Date Range Picker (`components/dashboard/date-range-picker.tsx`)

```tsx
"use client";

import * as React from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
}

const presets = [
  { label: "Today", value: "today", days: 0 },
  { label: "Last 7 days", value: "7d", days: 7 },
  { label: "Last 14 days", value: "14d", days: 14 },
  { label: "Last 30 days", value: "30d", days: 30 },
  { label: "Last 90 days", value: "90d", days: 90 },
];

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handlePresetChange = (value: string) => {
    const preset = presets.find((p) => p.value === value);
    if (preset) {
      const to = endOfDay(new Date());
      const from = startOfDay(subDays(new Date(), preset.days));
      onDateRangeChange({ from, to });
      setIsOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDateRangeChange(undefined);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal min-w-[240px]",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "MMM d, yyyy")} -{" "}
                  {format(dateRange.to, "MMM d, yyyy")}
                </>
              ) : (
                format(dateRange.from, "MMM d, yyyy")
              )
            ) : (
              <span>All time</span>
            )}
            {dateRange && (
              <X
                className="ml-auto h-4 w-4 hover:text-destructive"
                onClick={handleClear}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <div className="border-r p-2 space-y-1">
              <p className="text-sm font-medium px-2 py-1">Quick select</p>
              {presets.map((preset) => (
                <Button
                  key={preset.value}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handlePresetChange(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="p-2">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => {
                  onDateRangeChange(range);
                  if (range?.from && range?.to) {
                    setIsOpen(false);
                  }
                }}
                numberOfMonths={2}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

### 3. Update Filters Component (`components/dashboard/filters.tsx`)

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "./date-range-picker";

interface FiltersProps {
  branches: string[];
}

export function Filters({ branches }: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize date range from URL
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get("dateFrom");
    const to = searchParams.get("dateTo");
    if (from && to) {
      return { from: new Date(from), to: new Date(to) };
    }
    return undefined;
  });

  const currentStatus = searchParams.get("status") || "all";
  const currentBranch = searchParams.get("branch") || "all";

  const updateFilters = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

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

      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearFilters = () => {
    setDateRange(undefined);
    router.push("/");
  };

  const hasFilters = currentStatus !== "all" || currentBranch !== "all" || dateRange;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <DateRangePicker
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
      />

      <Select
        value={currentStatus}
        onValueChange={(value) => updateFilters("status", value)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="success">Success</SelectItem>
          <SelectItem value="failure">Failure</SelectItem>
          <SelectItem value="running">Running</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={currentBranch}
        onValueChange={(value) => updateFilters("branch", value)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Branch" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Branches</SelectItem>
          {branches.map((branch) => (
            <SelectItem key={branch} value={branch}>
              {branch}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear all
        </Button>
      )}
    </div>
  );
}
```

### 4. Update Main Page (`app/page.tsx`)

```tsx
// Update data fetching to include date parameters
interface PageProps {
  searchParams: Promise<{
    status?: string;
    branch?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { status, branch, dateFrom, dateTo } = params;

  const [metrics, trends, executionsData] = await Promise.all([
    getDashboardMetrics(dateFrom, dateTo),
    getTrendData(7, dateFrom, dateTo),
    getExecutions(50, status, branch, dateFrom, dateTo),
    getBranches(),
  ]);

  // ... rest of component
}
```

---

## API Specification

### Updated Query Parameters

All data endpoints now accept:

| Parameter | Type | Format | Description |
|-----------|------|--------|-------------|
| dateFrom | string | ISO 8601 | Start of date range |
| dateTo | string | ISO 8601 | End of date range |

**Example:**
```
GET /api/executions?dateFrom=2025-12-01T00:00:00Z&dateTo=2025-12-25T23:59:59Z
```

---

## Testing Checklist

- [ ] Date picker opens and closes correctly
- [ ] Quick select presets work (Today, 7d, 14d, 30d, 90d)
- [ ] Custom date range selection works
- [ ] Date range persists in URL parameters
- [ ] Date range survives page refresh
- [ ] Executions table filters by date
- [ ] Metrics update based on date range
- [ ] Trend chart updates based on date range
- [ ] Clear button removes all filters
- [ ] Combined filters work (date + status + branch)
- [ ] Shareable URLs work with date parameters

---

## Files to Create/Modify

### Create:
- `components/dashboard/date-range-picker.tsx`

### Modify:
- `lib/db.ts` - Add date parameters to queries
- `app/api/executions/route.ts` - Parse date params
- `app/api/metrics/route.ts` - Parse date params
- `app/api/trends/route.ts` - Parse date params
- `components/dashboard/filters.tsx` - Add DateRangePicker
- `app/page.tsx` - Pass date params to data fetching

### Install:
```bash
npx shadcn@latest add calendar popover
npm install date-fns react-day-picker
```

---

*Phase 05 Complete → Proceed to Phase 06: Flaky Test Detection*
