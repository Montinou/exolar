# Phase 12: CSV Export

> **Priority:** Low | **Complexity:** Low | **Dependencies:** None
>
> Export test data to CSV for offline analysis and reporting.

---

## Objective

1. Create CSV export endpoints
2. Add download buttons to UI
3. Support filtering by date range and status
4. Include all relevant test data

---

## Prerequisites

- Basic dashboard implementation complete

---

## Database Changes

**No database migrations required** - uses existing data.

---

## Backend Implementation

### 1. Create CSV Utilities (`lib/csv.ts`)

```typescript
/**
 * Convert array of objects to CSV string
 */
export function toCSV<T extends Record<string, unknown>>(
  data: T[],
  columns?: { key: keyof T; header: string }[]
): string {
  if (data.length === 0) return "";

  // Determine columns
  const cols = columns || Object.keys(data[0]).map((key) => ({
    key: key as keyof T,
    header: key,
  }));

  // Create header row
  const header = cols.map((col) => escapeCSVField(col.header)).join(",");

  // Create data rows
  const rows = data.map((row) =>
    cols
      .map((col) => {
        const value = row[col.key];
        return escapeCSVField(formatValue(value));
      })
      .join(",")
  );

  return [header, ...rows].join("\n");
}

/**
 * Escape CSV field value
 */
function escapeCSVField(value: string): string {
  // If value contains comma, newline, or quote, wrap in quotes
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    // Escape quotes by doubling them
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format value for CSV
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Create response with CSV content
 */
export function createCSVResponse(
  csv: string,
  filename: string
): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-cache",
    },
  });
}
```

### 2. Create Executions Export API (`app/api/export/executions/route.ts`)

```typescript
import { getExecutions } from "@/lib/db";
import { toCSV, createCSVResponse } from "@/lib/csv";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const branch = searchParams.get("branch") || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;
    const limit = parseInt(searchParams.get("limit") || "1000");

    const executions = await getExecutions(limit, status, branch, dateFrom, dateTo);

    const columns = [
      { key: "id" as const, header: "ID" },
      { key: "run_id" as const, header: "Run ID" },
      { key: "branch" as const, header: "Branch" },
      { key: "commit_sha" as const, header: "Commit SHA" },
      { key: "commit_message" as const, header: "Commit Message" },
      { key: "triggered_by" as const, header: "Triggered By" },
      { key: "workflow_name" as const, header: "Workflow" },
      { key: "status" as const, header: "Status" },
      { key: "total_tests" as const, header: "Total Tests" },
      { key: "passed" as const, header: "Passed" },
      { key: "failed" as const, header: "Failed" },
      { key: "skipped" as const, header: "Skipped" },
      { key: "duration_ms" as const, header: "Duration (ms)" },
      { key: "started_at" as const, header: "Started At" },
      { key: "completed_at" as const, header: "Completed At" },
    ];

    const csv = toCSV(executions, columns);

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `executions-${timestamp}.csv`;

    return createCSVResponse(csv, filename);
  } catch (error) {
    console.error("Error exporting executions:", error);
    return new Response("Export failed", { status: 500 });
  }
}
```

### 3. Create Test Results Export API (`app/api/export/results/route.ts`)

```typescript
import { toCSV, createCSVResponse } from "@/lib/csv";
import { NextRequest } from "next/server";
import { getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

function getSqlInstance() {
  return getSql();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get("executionId");
    const status = searchParams.get("status") || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;
    const limit = parseInt(searchParams.get("limit") || "5000");

    const sql = getSqlInstance();

    // Build query based on filters
    const results = await sql`
      SELECT
        tr.id,
        tr.test_name,
        tr.test_file,
        tr.test_signature,
        tr.status,
        tr.duration_ms,
        tr.is_critical,
        tr.is_flaky,
        tr.failure_category,
        tr.error_message,
        tr.browser,
        tr.retry_count,
        tr.started_at,
        tr.completed_at,
        te.branch,
        te.commit_sha,
        te.run_id
      FROM test_results tr
      JOIN test_executions te ON tr.execution_id = te.id
      WHERE
        (${executionId}::int IS NULL OR tr.execution_id = ${executionId}::int)
        AND (${status}::text IS NULL OR tr.status = ${status})
        AND (${dateFrom}::text IS NULL OR tr.started_at >= ${dateFrom}::timestamptz)
        AND (${dateTo}::text IS NULL OR tr.started_at <= ${dateTo}::timestamptz)
      ORDER BY tr.started_at DESC
      LIMIT ${limit}
    `;

    const columns = [
      { key: "id" as const, header: "ID" },
      { key: "test_name" as const, header: "Test Name" },
      { key: "test_file" as const, header: "Test File" },
      { key: "test_signature" as const, header: "Signature" },
      { key: "status" as const, header: "Status" },
      { key: "duration_ms" as const, header: "Duration (ms)" },
      { key: "is_critical" as const, header: "Is Critical" },
      { key: "is_flaky" as const, header: "Is Flaky" },
      { key: "failure_category" as const, header: "Failure Category" },
      { key: "error_message" as const, header: "Error Message" },
      { key: "browser" as const, header: "Browser" },
      { key: "retry_count" as const, header: "Retry Count" },
      { key: "branch" as const, header: "Branch" },
      { key: "commit_sha" as const, header: "Commit" },
      { key: "run_id" as const, header: "Run ID" },
      { key: "started_at" as const, header: "Started At" },
      { key: "completed_at" as const, header: "Completed At" },
    ];

    const csv = toCSV(results as Record<string, unknown>[], columns);

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = executionId
      ? `test-results-${executionId}-${timestamp}.csv`
      : `test-results-${timestamp}.csv`;

    return createCSVResponse(csv, filename);
  } catch (error) {
    console.error("Error exporting results:", error);
    return new Response("Export failed", { status: 500 });
  }
}
```

### 4. Create Flakiness Export API (`app/api/export/flakiness/route.ts`)

```typescript
import { getFlakiestTests } from "@/lib/db";
import { toCSV, createCSVResponse } from "@/lib/csv";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const minRuns = parseInt(searchParams.get("minRuns") || "5");

    const tests = await getFlakiestTests(limit, minRuns);

    const columns = [
      { key: "test_signature" as const, header: "Signature" },
      { key: "test_name" as const, header: "Test Name" },
      { key: "test_file" as const, header: "Test File" },
      { key: "total_runs" as const, header: "Total Runs" },
      { key: "flaky_runs" as const, header: "Flaky Runs" },
      { key: "passed_runs" as const, header: "Passed Runs" },
      { key: "failed_runs" as const, header: "Failed Runs" },
      { key: "flakiness_rate" as const, header: "Flakiness Rate (%)" },
      { key: "avg_duration_ms" as const, header: "Avg Duration (ms)" },
      { key: "last_flaky_at" as const, header: "Last Flaky At" },
      { key: "updated_at" as const, header: "Updated At" },
    ];

    const csv = toCSV(tests as unknown as Record<string, unknown>[], columns);

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `flaky-tests-${timestamp}.csv`;

    return createCSVResponse(csv, filename);
  } catch (error) {
    console.error("Error exporting flakiness data:", error);
    return new Response("Export failed", { status: 500 });
  }
}
```

---

## Frontend Implementation

### 1. Create Export Button Component (`components/dashboard/export-button.tsx`)

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";

interface ExportButtonProps {
  executionId?: number;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  branch?: string;
}

export function ExportButton({
  executionId,
  dateFrom,
  dateTo,
  status,
  branch,
}: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (type: "executions" | "results" | "flakiness") => {
    setExporting(true);

    try {
      const params = new URLSearchParams();
      if (executionId) params.set("executionId", executionId.toString());
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (status && status !== "all") params.set("status", status);
      if (branch && branch !== "all") params.set("branch", branch);

      const response = await fetch(`/api/export/${type}?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `export-${type}.csv`;

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export error:", error);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting}>
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("executions")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Executions
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("results")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Test Results
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("flakiness")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Flaky Tests
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 2. Install Dropdown Component

```bash
npx shadcn@latest add dropdown-menu
```

### 3. Add Export Button to Dashboard (`app/page.tsx`)

```tsx
import { ExportButton } from "@/components/dashboard/export-button";

// In the header or filters section:
<div className="flex items-center gap-4">
  <Filters branches={branches} />
  <ExportButton
    dateFrom={searchParams?.dateFrom}
    dateTo={searchParams?.dateTo}
    status={searchParams?.status}
    branch={searchParams?.branch}
  />
</div>
```

### 4. Add Export to Test Detail Modal

```tsx
import { ExportButton } from "./export-button";

// In the modal header:
<DialogTitle className="flex items-center justify-between">
  <span>Execution Details</span>
  <ExportButton executionId={execution.id} />
</DialogTitle>
```

---

## API Specification

### GET /api/export/executions

Export test executions to CSV.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status |
| branch | string | Filter by branch |
| dateFrom | string | Start date filter |
| dateTo | string | End date filter |
| limit | number | Max rows (default 1000) |

**Response:** CSV file download

### GET /api/export/results

Export test results to CSV.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| executionId | number | Filter by execution |
| status | string | Filter by status |
| dateFrom | string | Start date filter |
| dateTo | string | End date filter |
| limit | number | Max rows (default 5000) |

**Response:** CSV file download

### GET /api/export/flakiness

Export flaky test analysis to CSV.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| limit | number | Max rows (default 100) |
| minRuns | number | Min runs threshold |

**Response:** CSV file download

---

## Sample CSV Output

### executions.csv

```csv
ID,Run ID,Branch,Commit SHA,Status,Total Tests,Passed,Failed,Duration (ms),Started At
1,run-123,main,abc1234,success,42,40,2,125000,2025-12-25T10:00:00Z
2,run-124,develop,def5678,failure,42,35,7,130000,2025-12-25T09:00:00Z
```

### test-results.csv

```csv
ID,Test Name,Test File,Status,Duration (ms),Is Flaky,Error Message,Branch
1,should login,tests/auth.spec.ts,passed,1500,false,,main
2,should checkout,tests/cart.spec.ts,failed,3000,false,Timeout exceeded,main
```

---

## Testing Checklist

- [ ] Executions export downloads CSV
- [ ] Test results export downloads CSV
- [ ] Flakiness export downloads CSV
- [ ] Date filters apply to export
- [ ] Status filters apply to export
- [ ] CSV opens correctly in Excel/Sheets
- [ ] Special characters escaped properly
- [ ] Large exports don't timeout
- [ ] Filename includes date

---

## Files to Create/Modify

### Create:
- `lib/csv.ts`
- `app/api/export/executions/route.ts`
- `app/api/export/results/route.ts`
- `app/api/export/flakiness/route.ts`
- `components/dashboard/export-button.tsx`

### Modify:
- `app/page.tsx` - Add ExportButton
- `components/dashboard/test-detail-modal.tsx` - Add export for single execution

### Install:
```bash
npx shadcn@latest add dropdown-menu
```

---

*Phase 12 Complete → Proceed to Phase 13: Real-Time Streaming*
