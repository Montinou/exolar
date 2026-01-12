# Phase 2: Ingestion Pipeline

> **Goal:** Generate embeddings during test result ingestion
> **Value Delivered:** New failures automatically get embeddings for clustering
> **Dependencies:** Phase 0 (database), Phase 1 (embedding utilities)
> **Estimated Steps:** 6

---

## Overview

This phase integrates embedding generation into the existing test result ingestion flow:
1. Add database functions for storing embeddings
2. Modify ingestion to generate embeddings for failed tests
3. Handle errors gracefully (embedding failure shouldn't break ingestion)
4. Add retry mechanism for failed embeddings
5. Add monitoring/logging

---

## Steps

### Step 2.1: Add Database Functions for Embeddings

**File:** `lib/db/embeddings.ts`

```typescript
/**
 * Database functions for vector embeddings
 */

import { getSql } from "./connection"
import { toVectorString } from "@/lib/ai"

/**
 * Store an embedding for a test result
 *
 * @param testResultId - ID of the test result
 * @param embedding - 768-dimensional embedding vector
 */
export async function storeEmbedding(
  testResultId: number,
  embedding: number[]
): Promise<void> {
  const sql = getSql()

  if (embedding.length !== 768) {
    throw new Error(
      `Invalid embedding dimensions: expected 768, got ${embedding.length}`
    )
  }

  await sql`
    UPDATE test_results
    SET error_embedding = ${toVectorString(embedding)}::vector
    WHERE id = ${testResultId}
  `
}

/**
 * Store embeddings for multiple test results
 *
 * @param embeddings - Array of {testResultId, embedding} pairs
 */
export async function storeEmbeddingsBatch(
  embeddings: Array<{ testResultId: number; embedding: number[] }>
): Promise<void> {
  const sql = getSql()

  if (embeddings.length === 0) return

  // Validate all embeddings have correct dimensions
  for (const { testResultId, embedding } of embeddings) {
    if (embedding.length !== 768) {
      console.error(`Invalid embedding for test ${testResultId}: ${embedding.length} dims`)
    }
  }

  // Filter valid embeddings
  const valid = embeddings.filter((e) => e.embedding.length === 768)

  if (valid.length === 0) return

  // Batch update using a single query with CASE
  // More efficient than N individual updates
  const cases = valid
    .map(
      ({ testResultId, embedding }) =>
        `WHEN id = ${testResultId} THEN '${toVectorString(embedding)}'::vector`
    )
    .join(" ")

  const ids = valid.map((e) => e.testResultId)

  await sql`
    UPDATE test_results
    SET error_embedding = CASE ${sql.unsafe(cases)} END
    WHERE id = ANY(${ids})
  `
}

/**
 * Get test results that need embeddings
 *
 * Returns failed tests without embeddings, ordered by most recent first.
 *
 * @param organizationId - Filter by organization
 * @param limit - Max results to return
 */
export async function getTestsNeedingEmbeddings(
  organizationId: number,
  limit: number = 100
): Promise<
  Array<{
    id: number
    error_message: string | null
    stack_trace: string | null
  }>
> {
  const sql = getSql()

  const results = await sql`
    SELECT tr.id, tr.error_message, tr.stack_trace
    FROM test_results tr
    INNER JOIN test_executions te ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
      AND tr.status IN ('failed', 'timedout')
      AND tr.error_embedding IS NULL
      AND (tr.error_message IS NOT NULL OR tr.stack_trace IS NOT NULL)
    ORDER BY tr.created_at DESC
    LIMIT ${limit}
  `

  return results as Array<{
    id: number
    error_message: string | null
    stack_trace: string | null
  }>
}

/**
 * Get embedding for a specific test result
 *
 * @param testResultId - ID of the test result
 * @returns Embedding as number array, or null if not found
 */
export async function getEmbedding(
  testResultId: number
): Promise<number[] | null> {
  const sql = getSql()

  const result = await sql`
    SELECT error_embedding::text as embedding
    FROM test_results
    WHERE id = ${testResultId}
      AND error_embedding IS NOT NULL
  `

  if (result.length === 0 || !result[0].embedding) {
    return null
  }

  // Parse PostgreSQL vector format "[0.1,0.2,0.3]"
  const vectorStr = result[0].embedding as string
  return vectorStr
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map(Number)
}

/**
 * Find similar failures using vector similarity
 *
 * @param embedding - Query embedding
 * @param executionId - Limit to specific execution (optional)
 * @param organizationId - Organization for cross-execution search
 * @param threshold - Max cosine distance (lower = more similar)
 * @param limit - Max results
 */
export async function findSimilarFailures(
  embedding: number[],
  options: {
    executionId?: number
    organizationId?: number
    threshold?: number
    limit?: number
  } = {}
): Promise<
  Array<{
    id: number
    test_name: string
    test_file: string
    error_message: string | null
    similarity: number
    execution_id: number
  }>
> {
  const sql = getSql()
  const { executionId, organizationId, threshold = 0.15, limit = 20 } = options

  const vectorStr = toVectorString(embedding)

  if (executionId) {
    // Search within single execution
    return await sql`
      SELECT
        id,
        test_name,
        test_file,
        error_message,
        execution_id,
        1 - (error_embedding <=> ${vectorStr}::vector) as similarity
      FROM test_results
      WHERE execution_id = ${executionId}
        AND error_embedding IS NOT NULL
        AND error_embedding <=> ${vectorStr}::vector < ${threshold}
      ORDER BY error_embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `
  } else if (organizationId) {
    // Search across organization
    return await sql`
      SELECT
        tr.id,
        tr.test_name,
        tr.test_file,
        tr.error_message,
        tr.execution_id,
        1 - (tr.error_embedding <=> ${vectorStr}::vector) as similarity
      FROM test_results tr
      INNER JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${organizationId}
        AND tr.error_embedding IS NOT NULL
        AND tr.error_embedding <=> ${vectorStr}::vector < ${threshold}
      ORDER BY tr.error_embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `
  }

  throw new Error("Either executionId or organizationId must be provided")
}
```

**Verification:**
- [ ] File created at `lib/db/embeddings.ts`
- [ ] Functions handle batch operations efficiently

---

### Step 2.2: Create Embedding Generation Service

**File:** `lib/services/embedding-service.ts`

```typescript
/**
 * Embedding Generation Service
 *
 * Handles generating and storing embeddings for test results.
 * Designed to be called during ingestion or as a background job.
 */

import {
  generateEmbedding,
  generateEmbeddingsBatch,
  prepareErrorForEmbedding,
} from "@/lib/ai"
import { storeEmbedding, storeEmbeddingsBatch } from "@/lib/db/embeddings"
import type { EmbeddingResult } from "@/lib/ai/types"

/**
 * Generate and store embedding for a single test result
 *
 * @param testResultId - ID of the test result
 * @param errorMessage - Error message from the test
 * @param stackTrace - Stack trace (optional)
 * @returns Success status and any error
 */
export async function generateAndStoreEmbedding(
  testResultId: number,
  errorMessage: string | null,
  stackTrace: string | null
): Promise<EmbeddingResult> {
  try {
    // Skip if no error content
    if (!errorMessage && !stackTrace) {
      return {
        testResultId,
        success: false,
        error: "No error content to embed",
      }
    }

    // Prepare error text for embedding
    const text = prepareErrorForEmbedding(errorMessage, stackTrace)

    // Generate embedding
    const embedding = await generateEmbedding(text)

    // Store in database
    await storeEmbedding(testResultId, embedding)

    return {
      testResultId,
      success: true,
      embedding,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Failed to generate embedding for test ${testResultId}:`, message)

    return {
      testResultId,
      success: false,
      error: message,
    }
  }
}

/**
 * Generate embeddings for multiple test results
 *
 * Optimized for batch processing with parallel API calls.
 *
 * @param testResults - Array of test results needing embeddings
 * @returns Array of results (success/failure per test)
 */
export async function generateAndStoreEmbeddingsBatch(
  testResults: Array<{
    id: number
    error_message: string | null
    stack_trace: string | null
  }>
): Promise<EmbeddingResult[]> {
  if (testResults.length === 0) {
    return []
  }

  // Prepare all texts
  const textsWithIds = testResults
    .filter((tr) => tr.error_message || tr.stack_trace)
    .map((tr) => ({
      id: tr.id,
      text: prepareErrorForEmbedding(tr.error_message, tr.stack_trace),
    }))

  if (textsWithIds.length === 0) {
    return testResults.map((tr) => ({
      testResultId: tr.id,
      success: false,
      error: "No error content to embed",
    }))
  }

  // Generate embeddings in batch
  const texts = textsWithIds.map((t) => t.text)
  const embeddings = await generateEmbeddingsBatch(texts)

  // Prepare results and store valid embeddings
  const results: EmbeddingResult[] = []
  const validEmbeddings: Array<{ testResultId: number; embedding: number[] }> = []

  for (let i = 0; i < textsWithIds.length; i++) {
    const { id } = textsWithIds[i]
    const embedding = embeddings[i]

    if (embedding && embedding.length === 768) {
      results.push({ testResultId: id, success: true, embedding })
      validEmbeddings.push({ testResultId: id, embedding })
    } else {
      results.push({
        testResultId: id,
        success: false,
        error: "Embedding generation failed or returned invalid dimensions",
      })
    }
  }

  // Batch store valid embeddings
  if (validEmbeddings.length > 0) {
    try {
      await storeEmbeddingsBatch(validEmbeddings)
    } catch (error) {
      console.error("Failed to store embeddings batch:", error)
      // Mark all as failed
      for (const result of results) {
        if (result.success) {
          result.success = false
          result.error = "Database storage failed"
        }
      }
    }
  }

  // Add results for tests that had no error content
  const processedIds = new Set(textsWithIds.map((t) => t.id))
  for (const tr of testResults) {
    if (!processedIds.has(tr.id)) {
      results.push({
        testResultId: tr.id,
        success: false,
        error: "No error content to embed",
      })
    }
  }

  return results
}

/**
 * Stats from embedding generation
 */
export interface EmbeddingStats {
  total: number
  succeeded: number
  failed: number
  skipped: number
  durationMs: number
}

/**
 * Generate embeddings for failed tests with progress tracking
 *
 * @param testResults - Tests to process
 * @param onProgress - Optional callback for progress updates
 */
export async function generateEmbeddingsWithProgress(
  testResults: Array<{
    id: number
    error_message: string | null
    stack_trace: string | null
  }>,
  onProgress?: (processed: number, total: number) => void
): Promise<EmbeddingStats> {
  const startTime = Date.now()
  const stats: EmbeddingStats = {
    total: testResults.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
  }

  if (testResults.length === 0) {
    return stats
  }

  // Process in batches of 10 to avoid overwhelming the API
  const BATCH_SIZE = 10

  for (let i = 0; i < testResults.length; i += BATCH_SIZE) {
    const batch = testResults.slice(i, i + BATCH_SIZE)
    const results = await generateAndStoreEmbeddingsBatch(batch)

    for (const result of results) {
      if (result.success) {
        stats.succeeded++
      } else if (result.error === "No error content to embed") {
        stats.skipped++
      } else {
        stats.failed++
      }
    }

    onProgress?.(i + batch.length, testResults.length)
  }

  stats.durationMs = Date.now() - startTime
  return stats
}
```

**Verification:**
- [ ] File created at `lib/services/embedding-service.ts`
- [ ] Handles batch processing efficiently
- [ ] Graceful error handling (no throwing)

---

### Step 2.3: Integrate into Ingestion API

**Modify:** `app/api/executions/route.ts` (POST handler)

Find the existing test result insertion loop and add embedding generation:

```typescript
// After inserting test results, generate embeddings for failed tests
// This happens asynchronously to not block the ingestion response

import { generateAndStoreEmbeddingsBatch } from "@/lib/services/embedding-service"

// ... existing code ...

// Inside POST handler, after inserting test results:

// Collect failed tests for embedding generation
const failedTests = testResults
  .filter((tr) => tr.status === "failed" || tr.status === "timedout")
  .map((tr, index) => ({
    id: insertedIds[index], // Get the inserted ID
    error_message: tr.error_message || null,
    stack_trace: tr.stack_trace || null,
  }))

// Generate embeddings asynchronously (don't await)
if (failedTests.length > 0) {
  // Fire and forget - don't block response
  generateAndStoreEmbeddingsBatch(failedTests)
    .then((results) => {
      const succeeded = results.filter((r) => r.success).length
      console.log(
        `Generated ${succeeded}/${failedTests.length} embeddings for execution ${executionId}`
      )
    })
    .catch((error) => {
      console.error(`Embedding generation failed for execution ${executionId}:`, error)
    })
}

// Return response immediately (don't wait for embeddings)
```

**Alternative: Synchronous approach (if you want embeddings before response):**

```typescript
// If you need embeddings to be available immediately:
if (failedTests.length > 0) {
  const results = await generateAndStoreEmbeddingsBatch(failedTests)
  const succeeded = results.filter((r) => r.success).length
  console.log(`Generated ${succeeded}/${failedTests.length} embeddings`)
}
```

**Verification:**
- [ ] Embedding generation integrated into ingestion flow
- [ ] Async approach to not block response

---

### Step 2.4: Create Backfill API Endpoint

**File:** `app/api/admin/backfill-embeddings/route.ts`

For generating embeddings for existing failed tests:

```typescript
/**
 * Admin API: Backfill embeddings for existing failures
 *
 * POST /api/admin/backfill-embeddings
 *
 * Generates embeddings for failed tests that don't have them yet.
 * Should be run once after initial deployment.
 */

import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getTestsNeedingEmbeddings } from "@/lib/db/embeddings"
import { generateEmbeddingsWithProgress } from "@/lib/services/embedding-service"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes

export async function POST(request: Request) {
  try {
    // Require admin
    const context = await getSessionContext()
    if (!context?.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    // Parse options
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 500, 1000) // Cap at 1000

    // Get tests needing embeddings
    const tests = await getTestsNeedingEmbeddings(context.organizationId, limit)

    if (tests.length === 0) {
      return NextResponse.json({
        message: "No tests need embeddings",
        stats: { total: 0, succeeded: 0, failed: 0, skipped: 0 },
      })
    }

    // Generate embeddings
    const stats = await generateEmbeddingsWithProgress(tests)

    return NextResponse.json({
      message: `Processed ${stats.total} tests`,
      stats,
    })
  } catch (error) {
    console.error("Backfill embeddings error:", error)
    return NextResponse.json(
      { error: "Failed to backfill embeddings" },
      { status: 500 }
    )
  }
}

/**
 * GET: Check how many tests need embeddings
 */
export async function GET() {
  try {
    const context = await getSessionContext()
    if (!context?.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    const tests = await getTestsNeedingEmbeddings(context.organizationId, 1)

    // Get total count
    const sql = (await import("@/lib/db/connection")).getSql()
    const countResult = await sql`
      SELECT COUNT(*) as count
      FROM test_results tr
      INNER JOIN test_executions te ON tr.execution_id = te.id
      WHERE te.organization_id = ${context.organizationId}
        AND tr.status IN ('failed', 'timedout')
        AND tr.error_embedding IS NULL
        AND (tr.error_message IS NOT NULL OR tr.stack_trace IS NOT NULL)
    `

    const needsEmbedding = Number(countResult[0]?.count || 0)

    return NextResponse.json({
      needsEmbedding,
      message:
        needsEmbedding > 0
          ? `${needsEmbedding} tests need embeddings`
          : "All tests have embeddings",
    })
  } catch (error) {
    console.error("Check embeddings error:", error)
    return NextResponse.json(
      { error: "Failed to check embeddings" },
      { status: 500 }
    )
  }
}
```

**Verification:**
- [ ] File created at `app/api/admin/backfill-embeddings/route.ts`
- [ ] GET endpoint to check status
- [ ] POST endpoint to run backfill
- [ ] Admin-only access

---

### Step 2.5: Update Database Index Exports

**Modify:** `lib/db/index.ts`

Add embeddings functions to the exports:

```typescript
// Add to existing imports
export * from "./embeddings"

// Add to getQueriesForOrg if needed
export function getQueriesForOrg(organizationId: number) {
  return {
    // ... existing functions ...

    // Embedding functions
    getTestsNeedingEmbeddings: (limit?: number) =>
      getTestsNeedingEmbeddings(organizationId, limit),
    findSimilarFailures: (
      embedding: number[],
      options?: { executionId?: number; threshold?: number; limit?: number }
    ) =>
      findSimilarFailures(embedding, { ...options, organizationId }),
  }
}
```

**Verification:**
- [ ] Embeddings exports added
- [ ] Organization-scoped functions available

---

### Step 2.6: Add Monitoring Logs

**File:** `lib/ai/monitoring.ts`

```typescript
/**
 * Monitoring utilities for AI features
 */

/**
 * Log embedding generation metrics
 */
export function logEmbeddingMetrics(metrics: {
  operation: "single" | "batch" | "backfill"
  count: number
  succeeded: number
  failed: number
  durationMs: number
  executionId?: number
  organizationId?: number
}) {
  const { operation, count, succeeded, failed, durationMs } = metrics

  const successRate = count > 0 ? ((succeeded / count) * 100).toFixed(1) : 0
  const avgMs = count > 0 ? (durationMs / count).toFixed(0) : 0

  console.log(
    `[Embeddings] ${operation}: ${succeeded}/${count} succeeded (${successRate}%) in ${durationMs}ms (avg ${avgMs}ms/embedding)`,
    metrics.executionId ? `execution=${metrics.executionId}` : "",
    metrics.organizationId ? `org=${metrics.organizationId}` : ""
  )

  // TODO: Send to Datadog/analytics if needed
}

/**
 * Track embedding generation errors
 */
export function logEmbeddingError(error: {
  testResultId: number
  errorType: string
  message: string
}) {
  console.error(
    `[Embeddings] Failed: test=${error.testResultId} type=${error.errorType}: ${error.message}`
  )

  // TODO: Send to error tracking (Sentry, Datadog) if needed
}
```

**Verification:**
- [ ] File created at `lib/ai/monitoring.ts`
- [ ] Structured logging for debugging

---

## Deliverables

| Item | Location | Status |
|------|----------|--------|
| DB embeddings functions | `lib/db/embeddings.ts` | ⬜ |
| Embedding service | `lib/services/embedding-service.ts` | ⬜ |
| Ingestion integration | `app/api/executions/route.ts` | ⬜ |
| Backfill API | `app/api/admin/backfill-embeddings/route.ts` | ⬜ |
| DB index exports | `lib/db/index.ts` | ⬜ |
| Monitoring | `lib/ai/monitoring.ts` | ⬜ |

---

## Testing

**1. Manual Test - Single Embedding:**

```bash
# Create a test failure and verify embedding is generated
curl -X POST http://localhost:3000/api/executions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "run_id": "test-123",
    "branch": "main",
    "commit_sha": "abc123",
    "results": [{
      "test_name": "Login test",
      "test_file": "auth.spec.ts",
      "status": "failed",
      "error_message": "TimeoutError: Navigation timeout exceeded",
      "stack_trace": "at Login.click(...)"
    }]
  }'

# Check if embedding was generated
psql $DATABASE_URL -c "
  SELECT id, test_name, error_embedding IS NOT NULL as has_embedding
  FROM test_results
  WHERE test_name = 'Login test'
  ORDER BY created_at DESC
  LIMIT 1;
"
```

**2. Test Backfill:**

```bash
# Check how many need embeddings
curl http://localhost:3000/api/admin/backfill-embeddings

# Run backfill (with admin auth)
curl -X POST http://localhost:3000/api/admin/backfill-embeddings \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'
```

---

## Next Phase

After completing Phase 2, proceed to [Phase 3: Clustering Backend](./phase-3-clustering-backend.md) to implement the failure clustering algorithm.
