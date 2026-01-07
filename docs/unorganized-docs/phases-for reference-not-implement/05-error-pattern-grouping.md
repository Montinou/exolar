# Phase 05: Error Pattern Grouping

> **Priority:** High | **Complexity:** Medium | **Dependencies:** None
>
> Cluster similar errors to identify systemic issues affecting multiple tests.

---

## Objective

1. Normalize error messages to identify patterns
2. Group similar errors across tests
3. Track error occurrence frequency
4. Display top error patterns in dashboard

---

## Prerequisites

- Basic dashboard implementation complete
- test_results table with error_message column

---

## Database Changes

### Migration Script: `scripts/004_error_patterns.sql`

```sql
-- Create error patterns tracking table
CREATE TABLE IF NOT EXISTS error_patterns (
  id SERIAL PRIMARY KEY,
  pattern_hash TEXT NOT NULL UNIQUE,
  error_pattern TEXT NOT NULL,
  sample_error_message TEXT,
  first_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1,
  affected_tests TEXT[] DEFAULT '{}',
  affected_files TEXT[] DEFAULT '{}',
  is_resolved BOOLEAN DEFAULT false,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_error_patterns_hash ON error_patterns(pattern_hash);
CREATE INDEX IF NOT EXISTS idx_error_patterns_count ON error_patterns(occurrence_count DESC);
CREATE INDEX IF NOT EXISTS idx_error_patterns_recent ON error_patterns(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_error_patterns_resolved ON error_patterns(is_resolved);

-- Add pattern hash reference to test_results
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS error_pattern_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_test_results_pattern ON test_results(error_pattern_hash);
```

---

## Backend Implementation

### 1. Update Types (`lib/types.ts`)

```typescript
// Error pattern interface
export interface ErrorPattern {
  id: number;
  pattern_hash: string;
  error_pattern: string;
  sample_error_message: string;
  first_seen: string;
  last_seen: string;
  occurrence_count: number;
  affected_tests: string[];
  affected_files: string[];
  is_resolved: boolean;
  resolution_notes: string | null;
}

// Summary for dashboard
export interface ErrorPatternSummary {
  total_patterns: number;
  unresolved_patterns: number;
  top_patterns: ErrorPattern[];
}
```

### 2. Create Error Pattern Utilities (`lib/error-patterns.ts`)

```typescript
import crypto from "crypto";

/**
 * Normalize error message to identify patterns
 * Removes dynamic parts like line numbers, paths, UUIDs, timestamps
 */
export function normalizeErrorMessage(errorMessage: string): string {
  if (!errorMessage) return "";

  return errorMessage
    // Remove line numbers (e.g., :42:10)
    .replace(/:\d+:\d+/g, ":X:X")
    // Remove file paths
    .replace(/\/[\w\/.-]+\.(ts|js|tsx|jsx|mjs|cjs)/g, "<file>")
    // Remove Windows paths
    .replace(/[A-Z]:\\[\w\\.-]+\.(ts|js|tsx|jsx)/gi, "<file>")
    // Remove UUIDs
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "<uuid>"
    )
    // Remove timestamps (ISO format)
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z?/g, "<timestamp>")
    // Remove numeric IDs that look like database IDs
    .replace(/\bid[=:]\s*\d+/gi, "id=<id>")
    // Remove hex strings (like hashes)
    .replace(/\b[0-9a-f]{32,}\b/gi, "<hash>")
    // Remove specific numbers that might be dynamic
    .replace(/\btimeout of \d+ms/gi, "timeout of <ms>ms")
    .replace(/\bafter \d+ms/gi, "after <ms>ms")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim()
    // Limit length for pattern matching
    .substring(0, 300);
}

/**
 * Generate MD5 hash for normalized error pattern
 */
export function generatePatternHash(normalizedError: string): string {
  return crypto.createHash("md5").update(normalizedError).digest("hex");
}

/**
 * Extract main error type from message
 */
export function extractErrorType(errorMessage: string): string {
  // Common error patterns
  const patterns = [
    /^(Error|TypeError|ReferenceError|SyntaxError):/,
    /^(TimeoutError|NetworkError|AssertionError):/,
    /^(Locator|Element|Selector)/,
    /expect\(.*\)\.(toBe|toEqual|toHaveText|toBeVisible)/,
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match) {
      return match[0];
    }
  }

  // Return first 50 chars as fallback
  return errorMessage.substring(0, 50);
}
```

### 3. Add Error Pattern Functions (`lib/db.ts`)

```typescript
import {
  normalizeErrorMessage,
  generatePatternHash,
} from "./error-patterns";

// Get top error patterns
export async function getTopErrorPatterns(
  limit: number = 10,
  includeResolved: boolean = false
): Promise<ErrorPattern[]> {
  const sql = getSql();

  const results = await sql`
    SELECT *
    FROM error_patterns
    WHERE ${includeResolved} OR is_resolved = false
    ORDER BY occurrence_count DESC, last_seen DESC
    LIMIT ${limit}
  `;

  return results as ErrorPattern[];
}

// Get error pattern summary
export async function getErrorPatternSummary(): Promise<ErrorPatternSummary> {
  const sql = getSql();

  const countResult = await sql`
    SELECT
      COUNT(*) as total_patterns,
      COUNT(*) FILTER (WHERE is_resolved = false) as unresolved_patterns
    FROM error_patterns
  `;

  const topPatterns = await getTopErrorPatterns(5, false);

  return {
    total_patterns: Number(countResult[0].total_patterns),
    unresolved_patterns: Number(countResult[0].unresolved_patterns),
    top_patterns: topPatterns,
  };
}

// Record or update error pattern
export async function recordErrorPattern(
  errorMessage: string,
  testName: string,
  testFile: string
): Promise<string> {
  const sql = getSql();

  const normalizedError = normalizeErrorMessage(errorMessage);
  const patternHash = generatePatternHash(normalizedError);

  await sql`
    INSERT INTO error_patterns (
      pattern_hash,
      error_pattern,
      sample_error_message,
      occurrence_count,
      affected_tests,
      affected_files,
      first_seen,
      last_seen
    ) VALUES (
      ${patternHash},
      ${normalizedError},
      ${errorMessage.substring(0, 1000)},
      1,
      ARRAY[${testName}],
      ARRAY[${testFile}],
      NOW(),
      NOW()
    )
    ON CONFLICT (pattern_hash) DO UPDATE SET
      occurrence_count = error_patterns.occurrence_count + 1,
      last_seen = NOW(),
      affected_tests = (
        SELECT ARRAY(
          SELECT DISTINCT unnest
          FROM unnest(error_patterns.affected_tests || ARRAY[${testName}])
          LIMIT 50
        )
      ),
      affected_files = (
        SELECT ARRAY(
          SELECT DISTINCT unnest
          FROM unnest(error_patterns.affected_files || ARRAY[${testFile}])
          LIMIT 20
        )
      ),
      sample_error_message = CASE
        WHEN LENGTH(${errorMessage}) > LENGTH(error_patterns.sample_error_message)
        THEN ${errorMessage.substring(0, 1000)}
        ELSE error_patterns.sample_error_message
      END,
      updated_at = NOW()
  `;

  return patternHash;
}

// Mark error pattern as resolved
export async function resolveErrorPattern(
  patternHash: string,
  notes?: string
): Promise<void> {
  const sql = getSql();

  await sql`
    UPDATE error_patterns
    SET
      is_resolved = true,
      resolution_notes = ${notes || null},
      updated_at = NOW()
    WHERE pattern_hash = ${patternHash}
  `;
}

// Get error pattern details
export async function getErrorPatternDetails(
  patternHash: string
): Promise<ErrorPattern | null> {
  const sql = getSql();

  const results = await sql`
    SELECT *
    FROM error_patterns
    WHERE pattern_hash = ${patternHash}
  `;

  return results[0] as ErrorPattern || null;
}

// Get tests affected by a pattern
export async function getTestsByErrorPattern(
  patternHash: string,
  limit: number = 20
): Promise<TestResult[]> {
  const sql = getSql();

  const results = await sql`
    SELECT tr.*, te.branch, te.commit_sha
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE tr.error_pattern_hash = ${patternHash}
    ORDER BY tr.started_at DESC
    LIMIT ${limit}
  `;

  return results as TestResult[];
}
```

### 4. Create Error Patterns API (`app/api/error-patterns/route.ts`)

```typescript
import {
  getTopErrorPatterns,
  getErrorPatternSummary,
} from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const includeResolved = searchParams.get("includeResolved") === "true";

    const [summary, patterns] = await Promise.all([
      getErrorPatternSummary(),
      getTopErrorPatterns(limit, includeResolved),
    ]);

    return NextResponse.json({
      summary,
      patterns,
    });
  } catch (error) {
    console.error("Error fetching error patterns:", error);
    return NextResponse.json(
      { error: "Failed to fetch error patterns" },
      { status: 500 }
    );
  }
}
```

### 5. Create Error Pattern Detail API (`app/api/error-patterns/[hash]/route.ts`)

```typescript
import {
  getErrorPatternDetails,
  getTestsByErrorPattern,
  resolveErrorPattern,
} from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    const [pattern, affectedTests] = await Promise.all([
      getErrorPatternDetails(hash),
      getTestsByErrorPattern(hash, limit),
    ]);

    if (!pattern) {
      return NextResponse.json(
        { error: "Pattern not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      pattern,
      affected_tests: affectedTests,
    });
  } catch (error) {
    console.error("Error fetching pattern details:", error);
    return NextResponse.json(
      { error: "Failed to fetch pattern details" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;
    const body = await request.json();

    if (body.action === "resolve") {
      await resolveErrorPattern(hash, body.notes);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating pattern:", error);
    return NextResponse.json(
      { error: "Failed to update pattern" },
      { status: 500 }
    );
  }
}
```

---

## Frontend Implementation

### 1. Create Error Patterns Card (`components/dashboard/error-patterns-card.tsx`)

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileCode,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ErrorPattern {
  id: number;
  pattern_hash: string;
  error_pattern: string;
  sample_error_message: string;
  occurrence_count: number;
  affected_tests: string[];
  affected_files: string[];
  is_resolved: boolean;
  last_seen: string;
}

interface ErrorPatternSummary {
  total_patterns: number;
  unresolved_patterns: number;
}

export function ErrorPatternsCard() {
  const [data, setData] = useState<{
    summary: ErrorPatternSummary;
    patterns: ErrorPattern[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPattern, setSelectedPattern] = useState<ErrorPattern | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/error-patterns?limit=5");
        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Failed to fetch error patterns:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleResolve = async (hash: string) => {
    try {
      await fetch(`/api/error-patterns/${hash}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve" }),
      });

      // Refresh data
      const response = await fetch("/api/error-patterns?limit=5");
      const json = await response.json();
      setData(json);
      setSelectedPattern(null);
    } catch (error) {
      console.error("Failed to resolve pattern:", error);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Error Patterns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.patterns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Error Patterns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <p>No recurring error patterns detected!</p>
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
            <AlertCircle className="h-5 w-5 text-red-500" />
            Error Patterns
          </span>
          <Badge variant="destructive">
            {data.summary.unresolved_patterns} unresolved
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.patterns.map((pattern) => (
            <Dialog key={pattern.pattern_hash}>
              <DialogTrigger asChild>
                <button
                  onClick={() => setSelectedPattern(pattern)}
                  className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm truncate text-red-600">
                        {pattern.error_pattern.substring(0, 80)}...
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {pattern.occurrence_count}x
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {pattern.affected_tests.length} tests affected
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Error Pattern Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Normalized Pattern</h4>
                    <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                      {pattern.error_pattern}
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Sample Error</h4>
                    <pre className="bg-red-50 dark:bg-red-950/20 p-3 rounded text-sm overflow-x-auto text-red-600">
                      {pattern.sample_error_message}
                    </pre>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Statistics</h4>
                      <dl className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Occurrences:</dt>
                          <dd className="font-medium">{pattern.occurrence_count}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Tests Affected:</dt>
                          <dd className="font-medium">{pattern.affected_tests.length}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Files Affected:</dt>
                          <dd className="font-medium">{pattern.affected_files.length}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Last Seen:</dt>
                          <dd className="font-medium">
                            {new Date(pattern.last_seen).toLocaleDateString()}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Affected Files</h4>
                      <ul className="text-sm space-y-1">
                        {pattern.affected_files.slice(0, 5).map((file) => (
                          <li key={file} className="flex items-center gap-1 text-muted-foreground">
                            <FileCode className="h-3 w-3" />
                            <span className="truncate">{file}</span>
                          </li>
                        ))}
                        {pattern.affected_files.length > 5 && (
                          <li className="text-xs text-muted-foreground">
                            +{pattern.affected_files.length - 5} more
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {!pattern.is_resolved && (
                    <Button
                      onClick={() => handleResolve(pattern.pattern_hash)}
                      className="w-full"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark as Resolved
                    </Button>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 2. Update Dashboard Layout (`app/page.tsx`)

```tsx
import { ErrorPatternsCard } from "@/components/dashboard/error-patterns-card";

// In the dashboard grid alongside FlakiestTestsCard:
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <FlakiestTestsCard />
  <ErrorPatternsCard />
</div>
```

---

## API Specification

### GET /api/error-patterns

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 10 | Max patterns to return |
| includeResolved | boolean | false | Include resolved patterns |

**Response:**
```json
{
  "summary": {
    "total_patterns": 25,
    "unresolved_patterns": 8
  },
  "patterns": [
    {
      "id": 1,
      "pattern_hash": "abc123...",
      "error_pattern": "Locator.click: Error: <file>:X:X timeout of <ms>ms exceeded",
      "sample_error_message": "Locator.click: Error: /tests/login.spec.ts:42:10 timeout of 30000ms exceeded...",
      "occurrence_count": 15,
      "affected_tests": ["should login", "should logout"],
      "affected_files": ["tests/login.spec.ts", "tests/auth.spec.ts"],
      "is_resolved": false,
      "last_seen": "2025-12-25T10:30:00Z"
    }
  ]
}
```

### GET /api/error-patterns/[hash]

**Response:**
```json
{
  "pattern": { /* ErrorPattern object */ },
  "affected_tests": [ /* TestResult[] */ ]
}
```

### PATCH /api/error-patterns/[hash]

**Request:**
```json
{
  "action": "resolve",
  "notes": "Fixed in PR #123"
}
```

---

## Testing Checklist

- [ ] Migration creates table and indexes
- [ ] Error normalization removes dynamic parts
- [ ] Same errors produce same pattern hash
- [ ] Pattern count increments on new occurrences
- [ ] Affected tests array updates correctly
- [ ] Error patterns card displays top 5
- [ ] Dialog shows full pattern details
- [ ] Mark as resolved works
- [ ] Empty state shows when no patterns

---

## Files to Create/Modify

### Create:
- `scripts/004_error_patterns.sql`
- `lib/error-patterns.ts`
- `app/api/error-patterns/route.ts`
- `app/api/error-patterns/[hash]/route.ts`
- `components/dashboard/error-patterns-card.tsx`

### Modify:
- `lib/types.ts` - Add ErrorPattern interfaces
- `lib/db.ts` - Add error pattern functions
- `app/page.tsx` - Add ErrorPatternsCard

---

## Rollback

```sql
-- Remove column and table
ALTER TABLE test_results DROP COLUMN IF EXISTS error_pattern_hash;
DROP TABLE IF EXISTS error_patterns;
```

---

*Phase 05 Complete → Proceed to Phase 06: Test Explorer - Slowest*
