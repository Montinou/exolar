# Phase 01: Test Signatures & Search

> **Priority:** High | **Complexity:** Low | **Dependencies:** None
>
> Enables historical tracking of individual tests across executions and provides search functionality.

---

## Objective

1. Generate unique signatures for each test to enable tracking across runs
2. Add search functionality to find tests by name or file path
3. Enable future features like flakiness tracking and test history

---

## Prerequisites

- Existing `test_results` table
- Basic dashboard implementation complete

---

## Database Changes

### Migration Script: `scripts/002_add_test_signatures.sql`

```sql
-- Add test signature column for historical tracking
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

-- Backfill existing records with signatures
UPDATE test_results
SET test_signature = MD5(test_file || '::' || test_name)
WHERE test_signature IS NULL;
```

---

## Backend Implementation

### 1. Update Types (`lib/types.ts`)

```typescript
// Add to existing TestResult interface
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
}
```

### 2. Update Database Functions (`lib/db.ts`)

```typescript
// Add signature generation utility
export function generateTestSignature(testFile: string, testName: string): string {
  // Use MD5 hash of file + name for consistent signatures
  const crypto = require('crypto');
  return crypto.createHash('md5').update(`${testFile}::${testName}`).digest('hex');
}

// Add search function
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
      ) as last_status
    FROM test_results
    WHERE test_name ILIKE ${'%' + query + '%'}
       OR test_file ILIKE ${'%' + query + '%'}
    GROUP BY test_name, test_file, test_signature
    ORDER BY run_count DESC
    LIMIT ${limit}
  `;

  return results as TestSearchResult[];
}

// Add function to get test history by signature
export async function getTestHistory(
  signature: string,
  limit: number = 20
): Promise<TestResult[]> {
  const sql = getSql();

  const results = await sql`
    SELECT
      tr.*,
      te.branch,
      te.commit_sha
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE tr.test_signature = ${signature}
       OR MD5(tr.test_file || '::' || tr.test_name) = ${signature}
    ORDER BY tr.started_at DESC
    LIMIT ${limit}
  `;

  return results as TestResult[];
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
import { getTestHistory } from "@/lib/db";
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

    const history = await getTestHistory(signature, limit);

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
      history,
      total_runs: history.length
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

### 1. Install Input Component

```bash
npx shadcn@latest add input
```

### 2. Create Search Component (`components/dashboard/search-tests.tsx`)

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, FileCode, CheckCircle2, XCircle } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface TestSearchResult {
  test_signature: string;
  test_name: string;
  test_file: string;
  run_count: number;
  last_run: string;
  last_status: string;
}

interface SearchTestsProps {
  onSelectTest?: (signature: string) => void;
}

export function SearchTests({ onSelectTest }: SearchTestsProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TestSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

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
    onSelectTest?.(signature);
    setIsOpen(false);
    setQuery("");
  };

  return (
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
                    <FileCode className="h-3 w-3" />
                    <span className="truncate">{result.test_file}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {result.last_status === "passed" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-muted-foreground">{result.run_count} runs</span>
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
  );
}
```

### 3. Create Debounce Hook (`hooks/use-debounce.ts`)

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

### 4. Update Dashboard Page (`app/page.tsx`)

Add SearchTests component to the header area:

```tsx
import { SearchTests } from "@/components/dashboard/search-tests";

// In the header section, add:
<div className="flex items-center gap-4">
  <SearchTests onSelectTest={(sig) => console.log("Selected:", sig)} />
  <UserMenu />
</div>
```

---

## API Specification

### GET /api/search

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| q | string | Yes | - | Search query (min 2 chars) |
| limit | number | No | 50 | Max results to return |

**Response:**
```json
{
  "tests": [
    {
      "test_signature": "a1b2c3d4e5f6...",
      "test_name": "should login successfully",
      "test_file": "tests/auth.spec.ts",
      "run_count": 42,
      "last_run": "2025-12-25T10:30:00Z",
      "last_status": "passed"
    }
  ]
}
```

### GET /api/tests/[signature]

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| signature | string | MD5 hash test signature |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 20 | Max history items |

**Response:**
```json
{
  "test_signature": "a1b2c3d4e5f6...",
  "test_name": "should login successfully",
  "test_file": "tests/auth.spec.ts",
  "total_runs": 42,
  "history": [
    {
      "id": 123,
      "status": "passed",
      "duration_ms": 1500,
      "started_at": "2025-12-25T10:30:00Z",
      "branch": "main",
      "commit_sha": "abc123"
    }
  ]
}
```

---

## Testing Checklist

- [ ] Migration script runs without errors
- [ ] Existing test_results records get backfilled signatures
- [ ] Search returns results for partial test names
- [ ] Search returns results for partial file paths
- [ ] Search is case-insensitive
- [ ] Results are sorted by run count (most frequently run first)
- [ ] Test history API returns correct historical data
- [ ] Search input debounces correctly (300ms)
- [ ] Empty state shows when no results
- [ ] Loading state shows during search

---

## Files to Create/Modify

### Create:
- `scripts/002_add_test_signatures.sql`
- `app/api/search/route.ts`
- `app/api/tests/[signature]/route.ts`
- `components/dashboard/search-tests.tsx`
- `hooks/use-debounce.ts`

### Modify:
- `lib/types.ts` - Add TestSearchResult interface
- `lib/db.ts` - Add search and history functions
- `app/page.tsx` - Add SearchTests to header

---

## Rollback

If issues occur, revert database changes:

```sql
-- Remove column (data will be lost)
ALTER TABLE test_results DROP COLUMN IF EXISTS test_signature;

-- Remove indexes
DROP INDEX IF EXISTS idx_test_results_signature;
DROP INDEX IF EXISTS idx_test_results_name_trgm;
DROP INDEX IF EXISTS idx_test_results_file_trgm;
```

---

*Phase 01 Complete → Proceed to Phase 02: Date Range Filter*
