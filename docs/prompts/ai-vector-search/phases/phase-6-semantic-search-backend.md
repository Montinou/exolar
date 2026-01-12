# Phase 6: Semantic Search Backend

> **Goal:** Create API for natural language test search
> **Value Delivered:** Search tests by intent, not just keywords
> **Dependencies:** Phase 5 (test index populated)
> **Estimated Steps:** 4

---

## Overview

This phase implements the semantic search API:
1. Create search database functions
2. Create hybrid search (semantic + keyword fallback)
3. Create API endpoint
4. Add search analytics

---

## Steps

### Step 6.1: Create Search Database Functions

**File:** `lib/db/semantic-search.ts`

```typescript
/**
 * Semantic Search Database Functions
 *
 * Enables natural language search for tests using vector similarity.
 */

import { getSql } from "./connection"
import { toVectorString } from "@/lib/ai"
import type { SemanticSearchResult } from "@/lib/ai/types"

/**
 * Perform pure semantic search using embeddings
 */
export async function semanticSearch(
  organizationId: number,
  queryEmbedding: number[],
  options: {
    limit?: number
    minSimilarity?: number
  } = {}
): Promise<SemanticSearchResult[]> {
  const sql = getSql()
  const { limit = 20, minSimilarity = 0.3 } = options

  const vectorStr = toVectorString(queryEmbedding)

  const results = await sql`
    SELECT
      test_signature as "testSignature",
      test_name as "testName",
      test_file as "testFile",
      1 - (search_embedding <=> ${vectorStr}::vector) as similarity,
      total_runs as "runCount",
      last_status as "lastStatus",
      pass_rate as "passRate"
    FROM test_search_index
    WHERE organization_id = ${organizationId}
      AND search_embedding IS NOT NULL
      AND 1 - (search_embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
    ORDER BY search_embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `

  return results as SemanticSearchResult[]
}

/**
 * Perform keyword search (fallback for short queries)
 */
export async function keywordSearch(
  organizationId: number,
  query: string,
  options: {
    limit?: number
  } = {}
): Promise<SemanticSearchResult[]> {
  const sql = getSql()
  const { limit = 20 } = options

  const pattern = `%${query.toLowerCase()}%`

  const results = await sql`
    SELECT
      test_signature as "testSignature",
      test_name as "testName",
      test_file as "testFile",
      CASE
        WHEN LOWER(test_name) LIKE ${pattern} THEN 0.9
        WHEN LOWER(test_file) LIKE ${pattern} THEN 0.7
        ELSE 0.5
      END as similarity,
      total_runs as "runCount",
      last_status as "lastStatus",
      pass_rate as "passRate"
    FROM test_search_index
    WHERE organization_id = ${organizationId}
      AND (
        LOWER(test_name) LIKE ${pattern}
        OR LOWER(test_file) LIKE ${pattern}
      )
    ORDER BY
      CASE WHEN LOWER(test_name) LIKE ${pattern} THEN 0 ELSE 1 END,
      total_runs DESC
    LIMIT ${limit}
  `

  return results as SemanticSearchResult[]
}

/**
 * Hybrid search: combines semantic and keyword
 *
 * - Short queries (< 3 words): keyword only
 * - Medium queries: hybrid (semantic + keyword)
 * - Long queries: semantic only
 */
export async function hybridSearch(
  organizationId: number,
  query: string,
  queryEmbedding: number[] | null,
  options: {
    limit?: number
    keywordWeight?: number
    semanticWeight?: number
  } = {}
): Promise<SemanticSearchResult[]> {
  const { limit = 20, keywordWeight = 0.3, semanticWeight = 0.7 } = options

  const wordCount = query.trim().split(/\s+/).length

  // Short queries: keyword only
  if (wordCount < 3 || !queryEmbedding) {
    return keywordSearch(organizationId, query, { limit })
  }

  // Get both result sets
  const [semanticResults, keywordResults] = await Promise.all([
    semanticSearch(organizationId, queryEmbedding, { limit }),
    keywordSearch(organizationId, query, { limit }),
  ])

  // Merge and deduplicate
  const resultMap = new Map<string, SemanticSearchResult>()

  // Add semantic results with weight
  for (const result of semanticResults) {
    resultMap.set(result.testSignature, {
      ...result,
      similarity: result.similarity * semanticWeight,
    })
  }

  // Add/merge keyword results with weight
  for (const result of keywordResults) {
    const existing = resultMap.get(result.testSignature)
    if (existing) {
      // Combine scores
      existing.similarity += result.similarity * keywordWeight
    } else {
      resultMap.set(result.testSignature, {
        ...result,
        similarity: result.similarity * keywordWeight,
      })
    }
  }

  // Sort by combined score and limit
  return Array.from(resultMap.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
}

/**
 * Get search suggestions based on partial query
 */
export async function getSearchSuggestions(
  organizationId: number,
  partialQuery: string,
  limit: number = 5
): Promise<string[]> {
  const sql = getSql()

  if (partialQuery.length < 2) return []

  const pattern = `${partialQuery.toLowerCase()}%`

  const results = await sql`
    SELECT DISTINCT test_name
    FROM test_search_index
    WHERE organization_id = ${organizationId}
      AND LOWER(test_name) LIKE ${pattern}
    ORDER BY total_runs DESC
    LIMIT ${limit}
  `

  return results.map((r) => r.test_name as string)
}
```

**Verification:**
- [ ] File created at `lib/db/semantic-search.ts`
- [ ] Semantic, keyword, and hybrid search functions
- [ ] Suggestion function for autocomplete

---

### Step 6.2: Create Search Service

**File:** `lib/services/search-service.ts`

```typescript
/**
 * Search Service
 *
 * Orchestrates test search combining semantic and keyword approaches.
 */

import { generateEmbedding } from "@/lib/ai"
import {
  hybridSearch,
  keywordSearch,
  getSearchSuggestions,
} from "@/lib/db/semantic-search"
import type { SemanticSearchResult } from "@/lib/ai/types"

export interface SearchOptions {
  limit?: number
  mode?: "hybrid" | "semantic" | "keyword"
}

export interface SearchResponse {
  results: SemanticSearchResult[]
  query: string
  mode: string
  totalResults: number
  searchTimeMs: number
}

/**
 * Search for tests by natural language query
 */
export async function searchTests(
  organizationId: number,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const startTime = Date.now()
  const { limit = 20, mode = "hybrid" } = options

  // Validate query
  const trimmedQuery = query.trim()
  if (trimmedQuery.length < 2) {
    return {
      results: [],
      query: trimmedQuery,
      mode,
      totalResults: 0,
      searchTimeMs: Date.now() - startTime,
    }
  }

  let results: SemanticSearchResult[]

  if (mode === "keyword") {
    // Pure keyword search
    results = await keywordSearch(organizationId, trimmedQuery, { limit })
  } else if (mode === "semantic") {
    // Pure semantic search (requires embedding)
    const embedding = await generateEmbedding(trimmedQuery)
    results = await hybridSearch(organizationId, trimmedQuery, embedding, {
      limit,
      keywordWeight: 0,
      semanticWeight: 1,
    })
  } else {
    // Hybrid (default)
    let embedding: number[] | null = null

    // Only generate embedding for longer queries
    if (trimmedQuery.split(/\s+/).length >= 3) {
      try {
        embedding = await generateEmbedding(trimmedQuery)
      } catch (error) {
        console.error("Failed to generate query embedding:", error)
        // Fall back to keyword search
      }
    }

    results = await hybridSearch(organizationId, trimmedQuery, embedding, { limit })
  }

  return {
    results,
    query: trimmedQuery,
    mode,
    totalResults: results.length,
    searchTimeMs: Date.now() - startTime,
  }
}

/**
 * Get autocomplete suggestions
 */
export async function getSuggestions(
  organizationId: number,
  partialQuery: string
): Promise<string[]> {
  return getSearchSuggestions(organizationId, partialQuery, 5)
}

/**
 * Example natural language queries and what they should find:
 *
 * "checkout tests" → tests with checkout in name/file
 * "tests for user authentication" → auth-related tests
 * "login flow validation" → login tests
 * "API endpoint tests" → tests in api/ directory
 * "tests that verify payment processing" → payment tests
 */
```

**Verification:**
- [ ] File created at `lib/services/search-service.ts`
- [ ] Orchestrates embedding generation + search
- [ ] Supports multiple search modes

---

### Step 6.3: Create Search API Endpoint

**File:** `app/api/search/semantic/route.ts`

```typescript
/**
 * API: Semantic Test Search
 *
 * GET /api/search/semantic?q={query}&mode={hybrid|semantic|keyword}
 *
 * Search tests using natural language.
 */

import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { searchTests, getSuggestions } from "@/lib/services/search-service"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const query = url.searchParams.get("q") || ""
    const mode = url.searchParams.get("mode") as "hybrid" | "semantic" | "keyword" | undefined
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50)
    const suggest = url.searchParams.get("suggest") === "true"

    // Autocomplete suggestions
    if (suggest) {
      const suggestions = await getSuggestions(context.organizationId, query)
      return NextResponse.json({ suggestions })
    }

    // Search
    const response = await searchTests(context.organizationId, query, {
      limit,
      mode,
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error("Semantic search error:", error)
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    )
  }
}
```

**Verification:**
- [ ] File created at `app/api/search/semantic/route.ts`
- [ ] Supports query, mode, limit params
- [ ] Autocomplete suggestions with `?suggest=true`

---

### Step 6.4: Update Exports

**Modify:** `lib/db/index.ts`

```typescript
// Add semantic search exports
export * from "./semantic-search"

// Add to getQueriesForOrg
import { semanticSearch, keywordSearch, hybridSearch, getSearchSuggestions } from "./semantic-search"

export function getQueriesForOrg(organizationId: number) {
  return {
    // ... existing functions ...

    // Semantic search
    semanticSearch: (embedding: number[], options?: { limit?: number; minSimilarity?: number }) =>
      semanticSearch(organizationId, embedding, options),
    keywordSearch: (query: string, options?: { limit?: number }) =>
      keywordSearch(organizationId, query, options),
    hybridSearch: (query: string, embedding: number[] | null, options?: { limit?: number }) =>
      hybridSearch(organizationId, query, embedding, options),
    getSearchSuggestions: (partialQuery: string, limit?: number) =>
      getSearchSuggestions(organizationId, partialQuery, limit),
  }
}
```

---

## Deliverables

| Item | Location | Status |
|------|----------|--------|
| Search DB functions | `lib/db/semantic-search.ts` | ⬜ |
| Search service | `lib/services/search-service.ts` | ⬜ |
| Search API | `app/api/search/semantic/route.ts` | ⬜ |
| DB exports | `lib/db/index.ts` | ⬜ |

---

## Testing

```bash
# Keyword search (short query)
curl "http://localhost:3000/api/search/semantic?q=login"

# Semantic search (natural language)
curl "http://localhost:3000/api/search/semantic?q=tests%20for%20checkout%20flow"

# Force semantic mode
curl "http://localhost:3000/api/search/semantic?q=payment&mode=semantic"

# Autocomplete
curl "http://localhost:3000/api/search/semantic?q=log&suggest=true"
```

**Expected Response:**
```json
{
  "results": [
    {
      "testSignature": "auth.spec.ts::should login successfully",
      "testName": "should login successfully",
      "testFile": "auth.spec.ts",
      "similarity": 0.92,
      "runCount": 150,
      "lastStatus": "passed",
      "passRate": 0.98
    }
  ],
  "query": "login tests",
  "mode": "hybrid",
  "totalResults": 5,
  "searchTimeMs": 45
}
```

---

## Next Phase

After completing Phase 6, proceed to [Phase 7: Semantic Search UI](./phase-7-semantic-search-ui.md).
