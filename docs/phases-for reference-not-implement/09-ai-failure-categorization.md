# Phase 09: AI Failure Categorization

> **Priority:** High | **Complexity:** Medium | **Dependencies:** Phase 05 (Error Patterns)
>
> Automatically classify test failures to prioritize investigation.

---

## Objective

1. Implement heuristics-based failure categorization
2. Add category columns to database
3. Display category badges in UI
4. Prepare for future LLM-based analysis

---

## Prerequisites

- Phase 05 completed (error patterns exist)
- Understanding of common failure types

---

## Failure Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `product_bug` | Actual application defect | Assertion failures, unexpected behavior |
| `automation_issue` | Test code problem | Locator failures, stale elements |
| `environment_issue` | Infrastructure problem | Timeouts, network errors, ECONNREFUSED |
| `flaky` | Non-deterministic failure | Passed on retry, timing issues |

---

## Database Changes

### Migration Script: `scripts/005_failure_categorization.sql`

```sql
-- Add categorization columns to test_results
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS failure_category TEXT CHECK (
  failure_category IN ('product_bug', 'automation_issue', 'environment_issue', 'flaky', NULL)
);
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS category_confidence DECIMAL(5,2);
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS category_reasoning TEXT;
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS category_source TEXT DEFAULT 'heuristics' CHECK (
  category_source IN ('heuristics', 'ai', 'manual', NULL)
);
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS categorized_at TIMESTAMP WITH TIME ZONE;

-- Index for category analysis
CREATE INDEX IF NOT EXISTS idx_test_results_category ON test_results(failure_category);
CREATE INDEX IF NOT EXISTS idx_test_results_category_source ON test_results(category_source);

-- Update error_patterns with common categories
ALTER TABLE error_patterns ADD COLUMN IF NOT EXISTS suggested_category TEXT CHECK (
  suggested_category IN ('product_bug', 'automation_issue', 'environment_issue', 'flaky', NULL)
);
```

---

## Backend Implementation

### 1. Update Types (`lib/types.ts`)

```typescript
// Failure category type
export type FailureCategory =
  | "product_bug"
  | "automation_issue"
  | "environment_issue"
  | "flaky";

// Category source
export type CategorySource = "heuristics" | "ai" | "manual";

// Categorization result
export interface FailureCategorization {
  category: FailureCategory;
  confidence: number; // 0-100
  reasoning: string;
  source: CategorySource;
}

// Update TestResult interface
export interface TestResult {
  // ... existing fields
  failure_category?: FailureCategory | null;
  category_confidence?: number | null;
  category_reasoning?: string | null;
  category_source?: CategorySource | null;
  categorized_at?: string | null;
}

// Category statistics
export interface CategoryStats {
  category: FailureCategory;
  count: number;
  percentage: number;
}
```

### 2. Create Categorization Logic (`lib/failure-categorization.ts`)

```typescript
import { FailureCategorization, FailureCategory } from "./types";

/**
 * Heuristics-based failure categorization
 * Analyzes error message and test metadata to determine failure type
 */
export function categorizeFailure(
  errorMessage: string | null | undefined,
  stackTrace: string | null | undefined,
  retryCount: number,
  status: string
): FailureCategorization {
  // Check for flaky first (passed after retry)
  if (retryCount > 0 && status === "passed") {
    return {
      category: "flaky",
      confidence: 95,
      reasoning: "Test passed after retry, indicating non-deterministic behavior",
      source: "heuristics",
    };
  }

  const error = (errorMessage || "").toLowerCase();
  const stack = (stackTrace || "").toLowerCase();

  // Environment issues - highest priority patterns
  const environmentPatterns = [
    { pattern: /timeout|timed out/i, confidence: 85, reason: "Timeout error detected" },
    { pattern: /econnrefused|econnreset/i, confidence: 90, reason: "Connection refused/reset" },
    { pattern: /enotfound|dns/i, confidence: 90, reason: "DNS/network resolution failure" },
    { pattern: /network|net::/i, confidence: 80, reason: "Network-related error" },
    { pattern: /enoent|file not found/i, confidence: 75, reason: "File system error" },
    { pattern: /memory|heap|oom/i, confidence: 85, reason: "Memory-related error" },
    { pattern: /certificate|ssl|tls/i, confidence: 80, reason: "SSL/TLS error" },
    { pattern: /container|docker|k8s/i, confidence: 75, reason: "Container infrastructure error" },
    { pattern: /503|502|504|service unavailable/i, confidence: 85, reason: "Server unavailable" },
    { pattern: /browsertype\.launch/i, confidence: 80, reason: "Browser launch failure" },
  ];

  for (const { pattern, confidence, reason } of environmentPatterns) {
    if (pattern.test(error) || pattern.test(stack)) {
      return {
        category: "environment_issue",
        confidence,
        reasoning: reason,
        source: "heuristics",
      };
    }
  }

  // Automation issues - test code problems
  const automationPatterns = [
    { pattern: /locator|selector|element.*not.*found/i, confidence: 85, reason: "Element locator failure" },
    { pattern: /strict mode|multiple elements/i, confidence: 90, reason: "Strict mode locator issue" },
    { pattern: /click.*intercepted/i, confidence: 80, reason: "Click intercepted by another element" },
    { pattern: /stale.*element/i, confidence: 85, reason: "Stale element reference" },
    { pattern: /navigation.*failed|goto.*failed/i, confidence: 75, reason: "Navigation failure" },
    { pattern: /frame.*detached/i, confidence: 80, reason: "Frame detached during operation" },
    { pattern: /waiting.*selector/i, confidence: 75, reason: "Selector wait timeout" },
    { pattern: /page\.locator|page\.getby/i, confidence: 70, reason: "Playwright locator error" },
    { pattern: /expect.*tobe.*visible/i, confidence: 70, reason: "Visibility assertion failed" },
    { pattern: /attach.*snapshot/i, confidence: 75, reason: "Snapshot operation failed" },
  ];

  for (const { pattern, confidence, reason } of automationPatterns) {
    if (pattern.test(error) || pattern.test(stack)) {
      return {
        category: "automation_issue",
        confidence,
        reasoning: reason,
        source: "heuristics",
      };
    }
  }

  // Product bugs - application defects
  const productBugPatterns = [
    { pattern: /assert(ion)?.*fail|expect.*to(be|equal|have|match)/i, confidence: 70, reason: "Assertion failure - possible product bug" },
    { pattern: /unexpected.*value|expected.*but.*got/i, confidence: 75, reason: "Unexpected value returned" },
    { pattern: /400|401|403|404|500/i, confidence: 60, reason: "HTTP error status code" },
    { pattern: /null|undefined.*error|cannot read/i, confidence: 65, reason: "Null/undefined reference error" },
    { pattern: /validation.*error|invalid.*input/i, confidence: 70, reason: "Validation error" },
    { pattern: /api.*error|response.*error/i, confidence: 65, reason: "API response error" },
  ];

  for (const { pattern, confidence, reason } of productBugPatterns) {
    if (pattern.test(error) || pattern.test(stack)) {
      return {
        category: "product_bug",
        confidence,
        reasoning: reason,
        source: "heuristics",
      };
    }
  }

  // Default: product bug with low confidence
  return {
    category: "product_bug",
    confidence: 40,
    reasoning: "Unable to determine category - requires manual investigation",
    source: "heuristics",
  };
}

/**
 * Get category display info
 */
export function getCategoryInfo(category: FailureCategory) {
  const info = {
    product_bug: {
      label: "Product Bug",
      description: "Actual application defect",
      color: "red",
      icon: "Bug",
    },
    automation_issue: {
      label: "Automation Issue",
      description: "Test code or locator problem",
      color: "orange",
      icon: "Code",
    },
    environment_issue: {
      label: "Environment Issue",
      description: "Infrastructure or network problem",
      color: "yellow",
      icon: "Server",
    },
    flaky: {
      label: "Flaky Test",
      description: "Non-deterministic failure",
      color: "amber",
      icon: "AlertTriangle",
    },
  };

  return info[category];
}
```

### 3. Add Categorization Functions (`lib/db.ts`)

```typescript
import { categorizeFailure } from "./failure-categorization";

// Categorize a test result and update database
export async function categorizeTestResult(
  testResultId: number
): Promise<FailureCategorization | null> {
  const sql = getSql();

  // Get test result
  const results = await sql`
    SELECT error_message, stack_trace, retry_count, status
    FROM test_results
    WHERE id = ${testResultId}
  `;

  if (results.length === 0) return null;

  const result = results[0];

  // Only categorize failed tests
  if (result.status !== "failed") return null;

  const categorization = categorizeFailure(
    result.error_message,
    result.stack_trace,
    result.retry_count || 0,
    result.status
  );

  // Update database
  await sql`
    UPDATE test_results
    SET
      failure_category = ${categorization.category},
      category_confidence = ${categorization.confidence},
      category_reasoning = ${categorization.reasoning},
      category_source = ${categorization.source},
      categorized_at = NOW()
    WHERE id = ${testResultId}
  `;

  return categorization;
}

// Batch categorize uncategorized results
export async function categorizeUncategorizedResults(
  limit: number = 100
): Promise<number> {
  const sql = getSql();

  const uncategorized = await sql`
    SELECT id, error_message, stack_trace, retry_count, status
    FROM test_results
    WHERE status = 'failed'
      AND failure_category IS NULL
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;

  let categorized = 0;

  for (const result of uncategorized) {
    const categorization = categorizeFailure(
      result.error_message,
      result.stack_trace,
      result.retry_count || 0,
      result.status
    );

    await sql`
      UPDATE test_results
      SET
        failure_category = ${categorization.category},
        category_confidence = ${categorization.confidence},
        category_reasoning = ${categorization.reasoning},
        category_source = ${categorization.source},
        categorized_at = NOW()
      WHERE id = ${result.id}
    `;

    categorized++;
  }

  return categorized;
}

// Get category statistics
export async function getCategoryStats(
  dateFrom?: string,
  dateTo?: string
): Promise<CategoryStats[]> {
  const sql = getSql();

  const results = await sql`
    SELECT
      failure_category as category,
      COUNT(*) as count
    FROM test_results
    WHERE status = 'failed'
      AND failure_category IS NOT NULL
      AND (${dateFrom || null}::text IS NULL OR started_at >= ${dateFrom}::timestamptz)
      AND (${dateTo || null}::text IS NULL OR started_at <= ${dateTo}::timestamptz)
    GROUP BY failure_category
    ORDER BY count DESC
  `;

  const total = results.reduce((sum, r) => sum + Number(r.count), 0);

  return results.map((r) => ({
    category: r.category as FailureCategory,
    count: Number(r.count),
    percentage: total > 0 ? (Number(r.count) / total) * 100 : 0,
  }));
}

// Override category manually
export async function overrideCategory(
  testResultId: number,
  category: FailureCategory,
  reasoning?: string
): Promise<void> {
  const sql = getSql();

  await sql`
    UPDATE test_results
    SET
      failure_category = ${category},
      category_confidence = 100,
      category_reasoning = ${reasoning || 'Manually categorized'},
      category_source = 'manual',
      categorized_at = NOW()
    WHERE id = ${testResultId}
  `;
}
```

### 4. Create Categorization API (`app/api/categorization/route.ts`)

```typescript
import {
  getCategoryStats,
  categorizeUncategorizedResults,
} from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    const stats = await getCategoryStats(dateFrom, dateTo);

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Error fetching category stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch category stats" },
      { status: 500 }
    );
  }
}

// POST to batch categorize
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const limit = body.limit || 100;

    const categorized = await categorizeUncategorizedResults(limit);

    return NextResponse.json({
      success: true,
      categorized,
    });
  } catch (error) {
    console.error("Error categorizing results:", error);
    return NextResponse.json(
      { error: "Failed to categorize results" },
      { status: 500 }
    );
  }
}
```

### 5. Create Override API (`app/api/categorization/[id]/route.ts`)

```typescript
import { overrideCategory } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.category) {
      return NextResponse.json(
        { error: "Category is required" },
        { status: 400 }
      );
    }

    await overrideCategory(parseInt(id), body.category, body.reasoning);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error overriding category:", error);
    return NextResponse.json(
      { error: "Failed to override category" },
      { status: 500 }
    );
  }
}
```

---

## Frontend Implementation

### 1. Create Category Badge (`components/dashboard/category-badge.tsx`)

```tsx
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Bug, Code, Server, AlertTriangle } from "lucide-react";
import { FailureCategory } from "@/lib/types";

interface CategoryBadgeProps {
  category: FailureCategory | null | undefined;
  confidence?: number | null;
  reasoning?: string | null;
  showTooltip?: boolean;
  size?: "sm" | "default";
}

const categoryConfig = {
  product_bug: {
    label: "Product Bug",
    icon: Bug,
    className: "bg-red-500/10 text-red-600 border-red-500/20",
  },
  automation_issue: {
    label: "Automation",
    icon: Code,
    className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  },
  environment_issue: {
    label: "Environment",
    icon: Server,
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  },
  flaky: {
    label: "Flaky",
    icon: AlertTriangle,
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
};

export function CategoryBadge({
  category,
  confidence,
  reasoning,
  showTooltip = true,
  size = "default",
}: CategoryBadgeProps) {
  if (!category) return null;

  const config = categoryConfig[category];
  const Icon = config.icon;

  const badge = (
    <Badge
      variant="outline"
      className={`${config.className} gap-1 ${size === "sm" ? "text-xs px-1.5 py-0" : ""}`}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {config.label}
      {confidence && confidence < 80 && (
        <span className="opacity-60">?</span>
      )}
    </Badge>
  );

  if (!showTooltip || !reasoning) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium">{config.label}</p>
          <p className="text-sm text-muted-foreground">{reasoning}</p>
          {confidence && (
            <p className="text-xs text-muted-foreground mt-1">
              Confidence: {confidence}%
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

### 2. Create Category Stats Card (`components/dashboard/category-stats-card.tsx`)

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Bug, Code, Server, AlertTriangle, BarChart3 } from "lucide-react";

interface CategoryStats {
  category: string;
  count: number;
  percentage: number;
}

const COLORS = {
  product_bug: "#ef4444",
  automation_issue: "#f97316",
  environment_issue: "#eab308",
  flaky: "#f59e0b",
};

const LABELS = {
  product_bug: "Product Bug",
  automation_issue: "Automation",
  environment_issue: "Environment",
  flaky: "Flaky",
};

export function CategoryStatsCard() {
  const [stats, setStats] = useState<CategoryStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/categorization");
        const data = await response.json();
        setStats(data.stats || []);
      } catch (error) {
        console.error("Failed to fetch category stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const chartData = stats.map((s) => ({
    name: LABELS[s.category as keyof typeof LABELS] || s.category,
    value: s.count,
    percentage: s.percentage,
  }));

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Failure Categories
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (stats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Failure Categories
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No categorized failures yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Failure Categories
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[stats[index].category as keyof typeof COLORS] || "#888"}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-popover border rounded-lg p-2 shadow-lg">
                      <p className="font-medium">{data.name}</p>
                      <p className="text-sm">
                        {data.value} ({data.percentage.toFixed(1)}%)
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span className="text-sm text-muted-foreground">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

### 3. Update Test Detail Modal

Add CategoryBadge to failed test items:

```tsx
import { CategoryBadge } from "./category-badge";

// In test item rendering for failed tests:
{test.status === "failed" && (
  <CategoryBadge
    category={test.failure_category}
    confidence={test.category_confidence}
    reasoning={test.category_reasoning}
  />
)}
```

---

## API Specification

### GET /api/categorization

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| dateFrom | string | Start date filter |
| dateTo | string | End date filter |

**Response:**
```json
{
  "stats": [
    { "category": "automation_issue", "count": 45, "percentage": 45.0 },
    { "category": "environment_issue", "count": 30, "percentage": 30.0 },
    { "category": "product_bug", "count": 20, "percentage": 20.0 },
    { "category": "flaky", "count": 5, "percentage": 5.0 }
  ]
}
```

### POST /api/categorization

Batch categorize uncategorized results.

**Request:**
```json
{ "limit": 100 }
```

### PATCH /api/categorization/[id]

Override category manually.

**Request:**
```json
{
  "category": "product_bug",
  "reasoning": "Confirmed as API bug in PR #123"
}
```

---

## Testing Checklist

- [ ] Migration adds columns without errors
- [ ] Heuristics correctly identify environment issues
- [ ] Heuristics correctly identify automation issues
- [ ] Flaky tests marked when retry_count > 0 + passed
- [ ] Category badge displays correctly
- [ ] Tooltip shows reasoning and confidence
- [ ] Stats card shows pie chart
- [ ] Batch categorization works
- [ ] Manual override updates category

---

## Files to Create/Modify

### Create:
- `scripts/005_failure_categorization.sql`
- `lib/failure-categorization.ts`
- `app/api/categorization/route.ts`
- `app/api/categorization/[id]/route.ts`
- `components/dashboard/category-badge.tsx`
- `components/dashboard/category-stats-card.tsx`

### Modify:
- `lib/types.ts` - Add categorization types
- `lib/db.ts` - Add categorization functions
- `components/dashboard/test-detail-modal.tsx` - Add CategoryBadge
- `app/page.tsx` - Add CategoryStatsCard

---

## Future Enhancement: LLM Integration

For Phase 2 AI (using Vercel AI SDK):

```typescript
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

async function categorizeWithAI(
  errorMessage: string,
  stackTrace: string
): Promise<FailureCategorization> {
  const { text } = await generateText({
    model: openai("gpt-4-turbo"),
    prompt: `Categorize this test failure...`,
  });
  // Parse response
}
```

---

*Phase 09 Complete → Proceed to Phase 10: Slack Notifications*
