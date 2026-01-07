# Phase 04: Test Signatures & Search

> **Priority:** High | **Complexity:** Low | **Dependencies:** Phases 01-03 (Foundation)
>
> Enables historical tracking of individual tests across executions and provides search functionality.

---

## Objective

1. Generate unique signatures for each test to enable tracking across runs
2. Add search functionality to find tests by name or file path
3. Enable future features like flakiness tracking and test history

---

## Prerequisites

- Foundation phases complete (data flowing to dashboard)
- Existing `test_results` table with data

---

## Database Changes

### Migration Script: `scripts/002_add_test_signatures.sql`

```sql
-- Add test signature column for historical tracking (if not exists from ingestion)
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS test_signature TEXT;

-- Create index for efficient signature lookups
CREATE INDEX IF NOT EXISTS idx_test_results_signature ON test_results(test_signature);

-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create indexes for text search
CREATE INDEX IF NOT EXISTS idx_test_results_name_trgm ON test_results
  USING gin (test_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_test_results_file_trgm ON test_results
  USING gin (test_file gin_trgm_ops);

-- Backfill existing records with signatures (if any missing)
UPDATE test_results
SET test_signature = MD5(test_file || '::' || test_name)
WHERE test_signature IS NULL;
```

---

## Backend Implementation

### 1. Update Types (`lib/types.ts`)

```typescript
// Add to existing TestResult interface (if not already present)
export interface TestResult {
  // ... existing fields
  test_signature?: string;
}

// New interface for search results
export interface TestSearchResult {
  test_signature: string;
  test_name: string;
  test_file: string;
  run_count: number;
  last_run: string;
  last_status: string;
  pass_rate: number;
}

// Interface for test history
export interface TestHistoryItem extends TestResult {
  branch: string;
  commit_sha: string;
  execution_status: string;
}
```

### 2. Add Database Functions (`lib/db.ts`)

```typescript
import crypto from 'crypto';

// Generate test signature
export function generateTestSignature(testFile: string, testName: string): string {
  return crypto.createHash('md5').update(`${testFile}::${testName}`).digest('hex');
}

// Search tests by name or file
export async function searchTests(
  query: string,
  limit: number = 50
): Promise<TestSearchResult[]> {
  const sql = getSql();

  if (!query || query.length < 2) {
    return [];
  }

  const results = await sql`
    SELECT
      COALESCE(test_signature, MD5(test_file || '::' || test_name)) as test_signature,
      test_name,
      test_file,
      COUNT(*) as run_count,
      MAX(started_at) as last_run,
      (
        SELECT status FROM test_results tr2
        WHERE tr2.test_name = test_results.test_name
          AND tr2.test_file = test_results.test_file
        ORDER BY started_at DESC LIMIT 1
      ) as last_status,
      ROUND(
        COUNT(*) FILTER (WHERE status = 'passed')::decimal
        / NULLIF(COUNT(*), 0) * 100, 1
      ) as pass_rate
    FROM test_results
    WHERE test_name ILIKE ${'%' + query + '%'}
       OR test_file ILIKE ${'%' + query + '%'}
    GROUP BY test_name, test_file, test_signature
    ORDER BY run_count DESC
    LIMIT ${limit}
  `;

  return results as TestSearchResult[];
}

// Get test history by signature
export async function getTestHistory(
  signature: string,
  limit: number = 20
): Promise<TestHistoryItem[]> {
  const sql = getSql();

  const results = await sql`
    SELECT
      tr.*,
      te.branch,
      te.commit_sha,
      te.status as execution_status
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE tr.test_signature = ${signature}
       OR MD5(tr.test_file || '::' || tr.test_name) = ${signature}
    ORDER BY tr.started_at DESC
    LIMIT ${limit}
  `;

  return results as TestHistoryItem[];
}

// Get test statistics
export async function getTestStatistics(signature: string): Promise<{
  total_runs: number;
  pass_rate: number;
  avg_duration_ms: number;
  flaky_rate: number;
  last_failure: string | null;
}> {
  const sql = getSql();

  const result = await sql`
    SELECT
      COUNT(*) as total_runs,
      ROUND(
        COUNT(*) FILTER (WHERE status = 'passed')::decimal
        / NULLIF(COUNT(*), 0) * 100, 1
      ) as pass_rate,
      ROUND(AVG(duration_ms)) as avg_duration_ms,
      ROUND(
        COUNT(*) FILTER (WHERE retry_count > 0 AND status = 'passed')::decimal
        / NULLIF(COUNT(*) FILTER (WHERE status = 'passed'), 0) * 100, 1
      ) as flaky_rate,
      MAX(started_at) FILTER (WHERE status = 'failed') as last_failure
    FROM test_results
    WHERE test_signature = ${signature}
       OR MD5(test_file || '::' || test_name) = ${signature}
  `;

  return {
    total_runs: Number(result[0].total_runs),
    pass_rate: Number(result[0].pass_rate) || 0,
    avg_duration_ms: Number(result[0].avg_duration_ms) || 0,
    flaky_rate: Number(result[0].flaky_rate) || 0,
    last_failure: result[0].last_failure,
  };
}
```

### 3. Create Search API Route (`app/api/search/route.ts`)

```typescript
import { searchTests } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "50");

    if (query.length < 2) {
      return NextResponse.json({
        tests: [],
        message: "Query must be at least 2 characters"
      });
    }

    const tests = await searchTests(query, limit);

    return NextResponse.json({ tests });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search tests" },
      { status: 500 }
    );
  }
}
```

### 4. Create Test History API Route (`app/api/tests/[signature]/route.ts`)

```typescript
import { getTestHistory, getTestStatistics } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ signature: string }> }
) {
  try {
    const { signature } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    const [history, statistics] = await Promise.all([
      getTestHistory(signature, limit),
      getTestStatistics(signature),
    ]);

    if (history.length === 0) {
      return NextResponse.json(
        { error: "Test not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      test_signature: signature,
      test_name: history[0].test_name,
      test_file: history[0].test_file,
      statistics,
      history,
    });
  } catch (error) {
    console.error("Test history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch test history" },
      { status: 500 }
    );
  }
}
```

---

## Frontend Implementation

### 1. Install Components

```bash
npx shadcn@latest add input dialog
```

### 2. Create Debounce Hook (`hooks/use-debounce.ts`)

```typescript
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

### 3. Create Search Component (`components/dashboard/search-tests.tsx`)

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, FileCode, CheckCircle2, XCircle, History } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { TestHistoryModal } from "./test-history-modal";

interface TestSearchResult {
  test_signature: string;
  test_name: string;
  test_file: string;
  run_count: number;
  last_run: string;
  last_status: string;
  pass_rate: number;
}

export function SearchTests() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TestSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, 300);

  const searchTests = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setResults(data.tests || []);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    searchTests(debouncedQuery);
  }, [debouncedQuery, searchTests]);

  const handleSelect = (signature: string) => {
    setSelectedTest(signature);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <>
      <div className="relative w-full max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tests by name or file..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="pl-10"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {isOpen && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
            {results.map((result) => (
              <button
                key={result.test_signature}
                onClick={() => handleSelect(result.test_signature)}
                className="w-full px-4 py-3 hover:bg-muted text-left border-b last:border-b-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.test_name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <FileCode className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{result.test_file}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm flex-shrink-0">
                    {result.last_status === "passed" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-muted-foreground">{result.run_count} runs</span>
                    <span className="text-muted-foreground">{result.pass_rate}%</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 p-4 text-center text-muted-foreground">
            No tests found matching "{query}"
          </div>
        )}
      </div>

      {selectedTest && (
        <TestHistoryModal
          signature={selectedTest}
          onClose={() => setSelectedTest(null)}
        />
      )}
    </>
  );
}
```

### 4. Create Test History Modal (`components/dashboard/test-history-modal.tsx`)

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Clock,
  GitBranch,
  Hash,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

interface TestStatistics {
  total_runs: number;
  pass_rate: number;
  avg_duration_ms: number;
  flaky_rate: number;
  last_failure: string | null;
}

interface TestHistoryItem {
  id: number;
  status: string;
  duration_ms: number;
  started_at: string;
  branch: string;
  commit_sha: string;
  retry_count: number;
  error_message?: string;
}

interface TestHistoryData {
  test_name: string;
  test_file: string;
  statistics: TestStatistics;
  history: TestHistoryItem[];
}

interface TestHistoryModalProps {
  signature: string;
  onClose: () => void;
}

export function TestHistoryModal({ signature, onClose }: TestHistoryModalProps) {
  const [data, setData] = useState<TestHistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const response = await fetch(`/api/tests/${signature}`);
        if (response.ok) {
          const json = await response.json();
          setData(json);
        }
      } catch (error) {
        console.error("Failed to fetch test history:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [signature]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {loading ? "Loading..." : data?.test_name}
          </DialogTitle>
          {data && (
            <p className="text-sm text-muted-foreground">{data.test_file}</p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading test history...
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Statistics */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <p className="text-2xl font-bold">{data.statistics.pass_rate}%</p>
                <p className="text-xs text-muted-foreground">Pass Rate</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <Hash className="h-5 w-5 mx-auto mb-1" />
                <p className="text-2xl font-bold">{data.statistics.total_runs}</p>
                <p className="text-xs text-muted-foreground">Total Runs</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <Clock className="h-5 w-5 mx-auto mb-1" />
                <p className="text-2xl font-bold">
                  {formatDuration(data.statistics.avg_duration_ms)}
                </p>
                <p className="text-xs text-muted-foreground">Avg Duration</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                <p className="text-2xl font-bold">{data.statistics.flaky_rate}%</p>
                <p className="text-xs text-muted-foreground">Flaky Rate</p>
              </div>
            </div>

            {/* History */}
            <div>
              <h3 className="font-medium mb-3">Recent Runs</h3>
              <div className="space-y-2">
                {data.history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {item.status === "passed" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{item.branch}</span>
                          <code className="text-xs text-muted-foreground">
                            {item.commit_sha.substring(0, 7)}
                          </code>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.started_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.retry_count > 0 && (
                        <Badge variant="outline" className="text-amber-600">
                          Retry {item.retry_count}
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {formatDuration(item.duration_ms)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Test not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### 5. Add Search to Dashboard (`app/page.tsx`)

```tsx
import { SearchTests } from "@/components/dashboard/search-tests";

// In the header section:
<div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-bold">E2E Test Dashboard</h1>
  <div className="flex items-center gap-4">
    <SearchTests />
    <UserMenu />
  </div>
</div>
```

---

## API Specification

### GET /api/search

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| q | string | - | Search query (min 2 chars) |
| limit | number | 50 | Max results |

**Response:**
```json
{
  "tests": [
    {
      "test_signature": "abc123...",
      "test_name": "should login successfully",
      "test_file": "tests/auth.spec.ts",
      "run_count": 42,
      "last_run": "2025-12-25T10:00:00Z",
      "last_status": "passed",
      "pass_rate": 95.2
    }
  ]
}
```

### GET /api/tests/[signature]

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 20 | Max history items |

**Response:**
```json
{
  "test_signature": "abc123...",
  "test_name": "should login successfully",
  "test_file": "tests/auth.spec.ts",
  "statistics": {
    "total_runs": 42,
    "pass_rate": 95.2,
    "avg_duration_ms": 5000,
    "flaky_rate": 5.0,
    "last_failure": "2025-12-20T10:00:00Z"
  },
  "history": [...]
}
```

---

## Testing Checklist

- [ ] Migration runs without errors
- [ ] Existing records get backfilled signatures
- [ ] Search returns results for partial names
- [ ] Search returns results for partial file paths
- [ ] Search is case-insensitive
- [ ] Results sorted by run count
- [ ] Test history shows correct data
- [ ] Statistics calculate correctly
- [ ] Modal displays history
- [ ] Debounce works (300ms)
- [ ] Empty state shows correctly

---

## Files to Create/Modify

### Create:
- `scripts/002_add_test_signatures.sql`
- `app/api/search/route.ts`
- `app/api/tests/[signature]/route.ts`
- `hooks/use-debounce.ts`
- `components/dashboard/search-tests.tsx`
- `components/dashboard/test-history-modal.tsx`

### Modify:
- `lib/types.ts` - Add search types
- `lib/db.ts` - Add search functions
- `app/page.tsx` - Add SearchTests

---

*Phase 04 Complete → Proceed to Phase 05: Date Range Filter*
