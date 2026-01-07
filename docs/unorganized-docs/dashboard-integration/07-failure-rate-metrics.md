# Phase 07: Failure Rate Metrics

> **Priority:** High | **Complexity:** Low | **Dependencies:** Foundation Phases
>
> Add failure rate tracking to dashboard metrics for better reliability insights.

---

## Objective

1. Calculate failure rate as a core dashboard metric
2. Display failure rate in stats cards
3. Add failure rate trend visualization
4. Track failure volume (rate x frequency)

---

## Prerequisites

- Foundation phases complete
- Test data in database

---

## Database Changes

**No database migrations required** - failure rate is calculated from existing data.

---

## Backend Implementation

### 1. Update Types (`lib/types.ts`)

```typescript
// Update DashboardMetrics interface
export interface DashboardMetrics {
  total_executions: number;
  pass_rate: number;
  failure_rate: number;        // NEW
  avg_duration_ms: number;
  critical_failures: number;
  last_24h_executions: number;
  failure_volume: number;      // NEW: represents impact
}

// New interface for failure trends
export interface FailureTrendData {
  date: string;
  failure_rate: number;
  total_tests: number;
  failed_tests: number;
}
```

### 2. Update Metrics Query (`lib/db.ts`)

The metrics query should already include `failure_rate` from Phase 05. If not:

```typescript
export async function getDashboardMetrics(
  dateFrom?: string,
  dateTo?: string
): Promise<DashboardMetrics> {
  const sql = getSql();

  const result = await sql`
    WITH execution_stats AS (
      SELECT
        COUNT(*) as total_executions,
        COUNT(*) FILTER (WHERE status = 'success') as successful,
        COUNT(*) FILTER (WHERE status = 'failure') as failed,
        AVG(duration_ms) as avg_duration
      FROM test_executions
      WHERE
        (${dateFrom || null}::text IS NULL OR started_at >= ${dateFrom}::timestamptz)
        AND (${dateTo || null}::text IS NULL OR started_at <= ${dateTo}::timestamptz)
    ),
    recent_stats AS (
      SELECT
        COUNT(*) FILTER (
          WHERE status = 'failure'
          AND started_at > NOW() - INTERVAL '7 days'
        ) as critical_failures,
        COUNT(*) FILTER (
          WHERE started_at > NOW() - INTERVAL '24 hours'
        ) as last_24h_executions
      FROM test_executions
    )
    SELECT
      es.total_executions,
      CASE
        WHEN es.total_executions > 0
        THEN ROUND(es.successful::decimal / es.total_executions * 100, 1)
        ELSE 0
      END as pass_rate,
      CASE
        WHEN es.total_executions > 0
        THEN ROUND(es.failed::decimal / es.total_executions * 100, 1)
        ELSE 0
      END as failure_rate,
      COALESCE(ROUND(es.avg_duration), 0) as avg_duration_ms,
      rs.critical_failures,
      rs.last_24h_executions,
      es.failed as failure_volume
    FROM execution_stats es, recent_stats rs
  `;

  return {
    total_executions: Number(result[0].total_executions),
    pass_rate: Number(result[0].pass_rate),
    failure_rate: Number(result[0].failure_rate),
    avg_duration_ms: Number(result[0].avg_duration_ms),
    critical_failures: Number(result[0].critical_failures),
    last_24h_executions: Number(result[0].last_24h_executions),
    failure_volume: Number(result[0].failure_volume)
  };
}
```

### 3. Add Failure Trend Function (`lib/db.ts`)

```typescript
export async function getFailureTrendData(
  days: number = 7,
  dateFrom?: string,
  dateTo?: string
): Promise<FailureTrendData[]> {
  const sql = getSql();

  const results = await sql`
    SELECT
      DATE(started_at) as date,
      COUNT(*) as total_tests,
      COUNT(*) FILTER (WHERE status = 'failure') as failed_tests,
      CASE
        WHEN COUNT(*) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE status = 'failure')::decimal / COUNT(*) * 100, 2)
        ELSE 0
      END as failure_rate
    FROM test_executions
    WHERE status != 'running'
      AND (
        CASE
          WHEN ${dateFrom}::text IS NOT NULL AND ${dateTo}::text IS NOT NULL
          THEN started_at >= ${dateFrom}::timestamptz AND started_at <= ${dateTo}::timestamptz
          ELSE started_at >= NOW() - (${days} || ' days')::interval
        END
      )
    GROUP BY DATE(started_at)
    ORDER BY date ASC
  `;

  return results as FailureTrendData[];
}
```

### 4. Update Trends API (`app/api/trends/route.ts`)

```typescript
import { getTrendData, getFailureTrendData } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "7");
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;
    const type = searchParams.get("type") || "tests"; // "tests" or "failures"

    if (type === "failures") {
      const failureTrends = await getFailureTrendData(days, dateFrom, dateTo);
      return NextResponse.json(failureTrends);
    }

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

### 1. Update Stats Cards (`components/dashboard/stats-cards.tsx`)

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface DashboardMetrics {
  total_executions: number;
  pass_rate: number;
  failure_rate: number;
  avg_duration_ms: number;
  critical_failures: number;
  last_24h_executions: number;
  failure_volume: number;
}

interface StatsCardsProps {
  metrics: DashboardMetrics;
}

export function StatsCards({ metrics }: StatsCardsProps) {
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const cards = [
    {
      title: "Pass Rate",
      value: `${metrics.pass_rate}%`,
      icon: CheckCircle2,
      description: `${metrics.total_executions} total runs`,
      trend: metrics.pass_rate >= 90 ? "positive" : metrics.pass_rate >= 70 ? "neutral" : "negative",
    },
    {
      title: "Failure Rate",
      value: `${metrics.failure_rate}%`,
      icon: XCircle,
      description: `${metrics.failure_volume} failed runs`,
      trend: metrics.failure_rate <= 5 ? "positive" : metrics.failure_rate <= 15 ? "neutral" : "negative",
    },
    {
      title: "Avg Duration",
      value: formatDuration(metrics.avg_duration_ms),
      icon: Clock,
      description: "per execution",
      trend: "neutral",
    },
    {
      title: "Critical Failures",
      value: metrics.critical_failures.toString(),
      icon: AlertTriangle,
      description: "last 7 days",
      trend: metrics.critical_failures === 0 ? "positive" : metrics.critical_failures <= 3 ? "neutral" : "negative",
    },
  ];

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "positive": return "text-green-500";
      case "negative": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };

  const getTrendBg = (trend: string) => {
    switch (trend) {
      case "positive": return "bg-green-500/10";
      case "negative": return "bg-red-500/10";
      default: return "bg-muted";
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <div className={`p-2 rounded-full ${getTrendBg(card.trend)}`}>
              <card.icon className={`h-4 w-4 ${getTrendColor(card.trend)}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### 2. Create Failure Rate Chart (`components/dashboard/failure-rate-chart.tsx`)

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, Loader2 } from "lucide-react";

interface FailureTrendData {
  date: string;
  failure_rate: number;
  total_tests: number;
  failed_tests: number;
}

interface FailureRateChartProps {
  dateFrom?: string;
  dateTo?: string;
}

export function FailureRateChart({ dateFrom, dateTo }: FailureRateChartProps) {
  const [data, setData] = useState<FailureTrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams({ type: "failures" });
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        const response = await fetch(`/api/trends?${params.toString()}`);
        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Failed to fetch failure trends:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [dateFrom, dateTo]);

  const formattedData = data.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  const avgFailureRate =
    data.length > 0
      ? data.reduce((sum, d) => sum + Number(d.failure_rate), 0) / data.length
      : 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Failure Rate Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Failure Rate Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No data available for selected period
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
            <TrendingDown className="h-5 w-5" />
            Failure Rate Trend
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            Avg: {avgFailureRate.toFixed(1)}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${value}%`}
              className="text-muted-foreground"
              domain={[0, "auto"]}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                      <p className="font-medium">{data.date}</p>
                      <p className="text-red-500 font-semibold">
                        Failure Rate: {Number(data.failure_rate).toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {data.failed_tests} failed / {data.total_tests} total
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine
              y={avgFailureRate}
              stroke="#888"
              strokeDasharray="3 3"
              label={{
                value: "Avg",
                position: "right",
                fontSize: 10,
              }}
            />
            <Line
              type="monotone"
              dataKey="failure_rate"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ fill: "#ef4444", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

### 3. Update Dashboard Layout (`app/page.tsx`)

```tsx
import { FailureRateChart } from "@/components/dashboard/failure-rate-chart";

// In the dashboard layout, add alongside or instead of TrendChart:
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <TrendChart data={trends} />
  <FailureRateChart
    dateFrom={params.dateFrom}
    dateTo={params.dateTo}
  />
</div>
```

---

## API Specification

### GET /api/metrics

**Response (updated):**
```json
{
  "total_executions": 150,
  "pass_rate": 85.5,
  "failure_rate": 14.5,
  "avg_duration_ms": 45000,
  "critical_failures": 3,
  "last_24h_executions": 12,
  "failure_volume": 22
}
```

### GET /api/trends?type=failures

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| type | string | "tests" | "tests" or "failures" |
| days | number | 7 | Days to look back |
| dateFrom | string | - | Start date (ISO 8601) |
| dateTo | string | - | End date (ISO 8601) |

**Response:**
```json
[
  {
    "date": "2025-12-20",
    "failure_rate": 10.5,
    "total_tests": 20,
    "failed_tests": 2
  },
  {
    "date": "2025-12-21",
    "failure_rate": 5.0,
    "total_tests": 20,
    "failed_tests": 1
  }
]
```

---

## Testing Checklist

- [ ] Failure rate displays correctly in stats cards
- [ ] Failure rate updates with date filter
- [ ] Failure volume calculates correctly
- [ ] Failure trend chart renders properly
- [ ] Trend chart shows average reference line
- [ ] Tooltip shows correct breakdown
- [ ] Empty state handled gracefully
- [ ] Color coding matches severity (green/yellow/red)
- [ ] Chart is responsive

---

## Files to Create/Modify

### Create:
- `components/dashboard/failure-rate-chart.tsx`

### Modify:
- `lib/types.ts` - Add failure_rate to DashboardMetrics
- `lib/db.ts` - Add getFailureTrendData function
- `app/api/trends/route.ts` - Add type parameter
- `components/dashboard/stats-cards.tsx` - Add failure rate card
- `app/page.tsx` - Add FailureRateChart

---

## Summary

This phase adds failure rate tracking and visualization:

- **Stats Card**: Shows failure rate % with color-coded status
- **Trend Chart**: Visualizes failure rate over time with average line
- **Integration**: Works with existing date filters

---

*Phase 07 Complete → Dashboard Integration MVP + Analytics Complete!*

---

## Next Steps (Optional Future Phases)

After completing the MVP + Analytics (Phases 01-07), consider:

1. **Error Pattern Grouping** - Cluster similar errors
2. **AI Failure Categorization** - Auto-categorize failures
3. **Slack Notifications** - Alert on failures
4. **GitHub PR Comments** - Report results on PRs
5. **Real-Time Streaming** - Live test progress
6. **CSV Export** - Download reports

See the original `e2e-test-dashboard/docs/phases/` for these additional phases.
