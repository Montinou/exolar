# Phase 1: Embedding Infrastructure

> **Goal:** Install Gemini SDK and create embedding generation utilities
> **Value Delivered:** Reusable embedding generation with error sanitization
> **Dependencies:** Phase 0 (pgvector enabled)
> **Estimated Steps:** 5

---

## Overview

This phase establishes the embedding generation infrastructure:
1. Install Google Generative AI SDK
2. Create embedding generation utility
3. Create error message sanitizer (remove noise)
4. Add TypeScript types for vectors
5. Create unit tests

---

## Steps

### Step 1.1: Install Google Generative AI SDK

**Command:**
```bash
npm install @google/generative-ai
```

**Verification:**
```bash
# Check package.json
grep "@google/generative-ai" package.json
```

**Expected output:**
```json
"@google/generative-ai": "^0.x.x"
```

---

### Step 1.2: Create Embedding Generation Utility

**File:** `lib/ai/embeddings.ts`

```typescript
/**
 * Embedding generation using Google Gemini text-embedding-004
 *
 * This module provides utilities for generating vector embeddings from text,
 * used for semantic similarity search and failure clustering.
 */

import { GoogleGenerativeAI } from "@google/generative-ai"

// Initialize Gemini client lazily (only when needed)
let genAI: GoogleGenerativeAI | null = null

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINIAI_API_KEY
    if (!apiKey) {
      throw new Error(
        "GEMINIAI_API_KEY environment variable is not set. " +
          "Please add it to your .env file."
      )
    }
    genAI = new GoogleGenerativeAI(apiKey)
  }
  return genAI
}

/**
 * Generate a vector embedding for the given text
 *
 * @param text - The text to embed (error message, stack trace, etc.)
 * @returns Array of 768 floats representing the embedding vector
 * @throws Error if API call fails or text is empty
 *
 * @example
 * const embedding = await generateEmbedding("TimeoutError: Navigation timeout of 30000ms exceeded")
 * // Returns: [0.012, -0.93, 0.45, ...]
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot generate embedding for empty text")
  }

  const client = getGenAI()
  const model = client.getGenerativeModel({ model: "text-embedding-004" })

  try {
    // Truncate if too long (Gemini has context limits)
    const truncatedText = truncateForEmbedding(text)

    const result = await model.embedContent(truncatedText)
    return result.embedding.values
  } catch (error) {
    // Wrap error with context
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to generate embedding: ${message}`)
  }
}

/**
 * Generate embeddings for multiple texts in batch
 *
 * More efficient than calling generateEmbedding() in a loop
 * as it batches API calls.
 *
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors (same order as input)
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }

  // Filter out empty texts and track indices
  const validTexts: { index: number; text: string }[] = []
  texts.forEach((text, index) => {
    if (text && text.trim().length > 0) {
      validTexts.push({ index, text: truncateForEmbedding(text) })
    }
  })

  if (validTexts.length === 0) {
    return texts.map(() => [])
  }

  const client = getGenAI()
  const model = client.getGenerativeModel({ model: "text-embedding-004" })

  // Batch size limit (Gemini may have rate limits)
  const BATCH_SIZE = 100
  const results: number[][] = new Array(texts.length).fill([])

  for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
    const batch = validTexts.slice(i, i + BATCH_SIZE)

    // Process batch in parallel
    const embeddings = await Promise.all(
      batch.map(async ({ index, text }) => {
        try {
          const result = await model.embedContent(text)
          return { index, embedding: result.embedding.values }
        } catch (error) {
          console.error(`Failed to embed text at index ${index}:`, error)
          return { index, embedding: [] }
        }
      })
    )

    // Assign results to correct positions
    for (const { index, embedding } of embeddings) {
      results[index] = embedding
    }
  }

  return results
}

/**
 * Truncate text to fit within embedding model limits
 *
 * Gemini text-embedding-004 has a context window of ~8192 tokens.
 * We truncate at ~6000 tokens (roughly 24000 chars) to be safe.
 */
function truncateForEmbedding(text: string): string {
  const MAX_CHARS = 24000 // ~6000 tokens at 4 chars/token

  if (text.length <= MAX_CHARS) {
    return text
  }

  // Truncate and add indicator
  return text.substring(0, MAX_CHARS - 20) + "\n... [truncated]"
}

/**
 * Calculate cosine similarity between two embeddings
 *
 * @returns Similarity score between 0 and 1 (1 = identical)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Embedding dimensions don't match: ${a.length} vs ${b.length}`
    )
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  if (magnitude === 0) return 0

  return dotProduct / magnitude
}

/**
 * Convert embedding array to PostgreSQL vector format
 *
 * @example
 * toVectorString([0.1, 0.2, 0.3]) // "[0.1,0.2,0.3]"
 */
export function toVectorString(embedding: number[]): string {
  return `[${embedding.join(",")}]`
}

/**
 * Parse PostgreSQL vector string to number array
 *
 * @example
 * parseVectorString("[0.1,0.2,0.3]") // [0.1, 0.2, 0.3]
 */
export function parseVectorString(vectorStr: string): number[] {
  // Remove brackets and split by comma
  const cleaned = vectorStr.replace(/^\[|\]$/g, "")
  return cleaned.split(",").map(Number)
}
```

**Verification:**
- [ ] File created at `lib/ai/embeddings.ts`
- [ ] Exports: `generateEmbedding`, `generateEmbeddingsBatch`, `cosineSimilarity`, `toVectorString`, `parseVectorString`
- [ ] Error handling for missing API key

---

### Step 1.3: Create Error Message Sanitizer

**File:** `lib/ai/sanitizer.ts`

```typescript
/**
 * Error Message Sanitizer
 *
 * Removes dynamic tokens (UUIDs, timestamps, session IDs) from error messages
 * to improve embedding consistency. Two identical errors with different
 * timestamps should produce similar embeddings.
 */

/**
 * Sanitize error message by removing dynamic content
 *
 * @param errorMessage - Raw error message from test failure
 * @returns Sanitized error message with dynamic content replaced
 *
 * @example
 * sanitizeErrorMessage("Failed at 2024-01-15T10:30:45Z: User abc-123-def not found")
 * // Returns: "Failed at [TIMESTAMP]: User [UUID] not found"
 */
export function sanitizeErrorMessage(errorMessage: string | null): string {
  if (!errorMessage) return ""

  let sanitized = errorMessage

  // Remove UUIDs (various formats)
  // Standard UUID: 8-4-4-4-12
  sanitized = sanitized.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    "[UUID]"
  )

  // Short hex IDs (8+ hex chars that look like IDs)
  sanitized = sanitized.replace(/\b[0-9a-f]{8,32}\b/gi, "[ID]")

  // Timestamps - ISO 8601
  sanitized = sanitized.replace(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g,
    "[TIMESTAMP]"
  )

  // Timestamps - Unix epoch (10 or 13 digit numbers)
  sanitized = sanitized.replace(/\b1[6-7]\d{8,11}\b/g, "[TIMESTAMP]")

  // Common date formats
  sanitized = sanitized.replace(
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    "[DATE]"
  )
  sanitized = sanitized.replace(
    /\b\d{4}-\d{2}-\d{2}\b/g,
    "[DATE]"
  )

  // Time formats
  sanitized = sanitized.replace(
    /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/g,
    "[TIME]"
  )

  // Session/token IDs (long alphanumeric strings)
  sanitized = sanitized.replace(
    /\b[A-Za-z0-9_-]{20,}\b/g,
    "[TOKEN]"
  )

  // IP addresses
  sanitized = sanitized.replace(
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    "[IP]"
  )

  // Port numbers after hosts
  sanitized = sanitized.replace(
    /:(\d{4,5})\b/g,
    ":[PORT]"
  )

  // File paths with dynamic segments (keep structure)
  // /tmp/playwright-123456/
  sanitized = sanitized.replace(
    /\/tmp\/[^\/\s]+\//g,
    "/tmp/[TEMP]/"
  )

  // Memory addresses
  sanitized = sanitized.replace(
    /0x[0-9a-f]+/gi,
    "[ADDR]"
  )

  // Line numbers in stack traces (normalize but keep structure)
  // Keep line numbers as they're useful for grouping
  // But normalize column numbers which vary more
  sanitized = sanitized.replace(
    /:(\d+):(\d+)\)/g,
    ":$1:[COL])"
  )

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, " ").trim()

  return sanitized
}

/**
 * Sanitize stack trace for embedding
 *
 * Stack traces contain useful structural info but also noise.
 * We keep the error type and call hierarchy but remove dynamic data.
 *
 * @param stackTrace - Full stack trace
 * @returns Sanitized stack trace
 */
export function sanitizeStackTrace(stackTrace: string | null): string {
  if (!stackTrace) return ""

  // First apply general sanitization
  let sanitized = sanitizeErrorMessage(stackTrace)

  // Additional stack-trace specific sanitization

  // Normalize file paths to relative (remove absolute prefix)
  // /Users/username/project/src/file.ts -> src/file.ts
  sanitized = sanitized.replace(
    /\/(?:Users|home)\/[^\/]+\/[^\/]+\//g,
    ""
  )

  // Windows paths
  sanitized = sanitized.replace(
    /[A-Z]:\\Users\\[^\\]+\\[^\\]+\\/gi,
    ""
  )

  // Node modules paths - keep package name but normalize path
  sanitized = sanitized.replace(
    /node_modules\/([^\/]+)\//g,
    "node_modules/$1/"
  )

  // Remove async context IDs
  sanitized = sanitized.replace(
    /async.*<anonymous>/g,
    "async [ANONYMOUS]"
  )

  return sanitized
}

/**
 * Prepare error content for embedding
 *
 * Combines error message and stack trace into a single string
 * optimized for embedding generation.
 *
 * @param errorMessage - Error message
 * @param stackTrace - Stack trace (optional)
 * @returns Combined, sanitized string ready for embedding
 */
export function prepareErrorForEmbedding(
  errorMessage: string | null,
  stackTrace: string | null
): string {
  const parts: string[] = []

  // Add sanitized error message
  const sanitizedMessage = sanitizeErrorMessage(errorMessage)
  if (sanitizedMessage) {
    parts.push(`Error: ${sanitizedMessage}`)
  }

  // Add sanitized stack trace (first few frames are most important)
  const sanitizedStack = sanitizeStackTrace(stackTrace)
  if (sanitizedStack) {
    // Keep first 10 stack frames (usually most relevant)
    const stackLines = sanitizedStack.split("\n").slice(0, 10)
    parts.push(`Stack:\n${stackLines.join("\n")}`)
  }

  return parts.join("\n\n")
}

/**
 * Extract error type from error message
 *
 * @example
 * extractErrorType("TimeoutError: Navigation timeout") // "TimeoutError"
 * extractErrorType("expect(received).toBe(expected)") // "AssertionError"
 */
export function extractErrorType(errorMessage: string | null): string {
  if (!errorMessage) return "UnknownError"

  // Common patterns
  const patterns: [RegExp, string][] = [
    [/^(\w+Error):/i, "$1"],
    [/^(\w+Exception):/i, "$1"],
    [/expect\(.+\)\.to/i, "AssertionError"],
    [/timeout/i, "TimeoutError"],
    [/ECONNREFUSED/i, "ConnectionError"],
    [/ENOTFOUND/i, "DNSError"],
    [/ETIMEDOUT/i, "TimeoutError"],
    [/selector.*not found/i, "ElementNotFoundError"],
    [/element.*not visible/i, "ElementNotVisibleError"],
  ]

  for (const [pattern, replacement] of patterns) {
    const match = errorMessage.match(pattern)
    if (match) {
      if (replacement.includes("$1")) {
        return replacement.replace("$1", match[1])
      }
      return replacement
    }
  }

  return "UnknownError"
}
```

**Verification:**
- [ ] File created at `lib/ai/sanitizer.ts`
- [ ] Exports: `sanitizeErrorMessage`, `sanitizeStackTrace`, `prepareErrorForEmbedding`, `extractErrorType`
- [ ] UUIDs, timestamps, IPs are replaced with placeholders

---

### Step 1.4: Add TypeScript Types

**File:** `lib/ai/types.ts`

```typescript
/**
 * TypeScript types for AI/Vector features
 */

/**
 * A vector embedding (768 dimensions for Gemini text-embedding-004)
 */
export type Embedding = number[]

/**
 * Result from a similarity search
 */
export interface SimilarityResult {
  id: number
  testName: string
  errorMessage: string | null
  similarity: number // 0-1 where 1 is identical
}

/**
 * A cluster of semantically similar failures
 */
export interface FailureCluster {
  clusterId: number
  representativeError: string
  testCount: number
  tests: ClusterMember[]
  centroidEmbedding?: Embedding
}

/**
 * A test result that belongs to a cluster
 */
export interface ClusterMember {
  testResultId: number
  testName: string
  testFile: string
  errorMessage: string | null
  distanceToCentroid: number // Lower = closer to cluster center
  isRepresentative: boolean // Is this the "most typical" failure?
}

/**
 * Options for clustering failures
 */
export interface ClusteringOptions {
  /**
   * Maximum cosine distance to be considered part of same cluster
   * Lower = stricter clustering (fewer, tighter clusters)
   * Higher = looser clustering (more tests per cluster)
   * @default 0.15
   */
  distanceThreshold?: number

  /**
   * Minimum number of tests to form a cluster
   * Prevents single-test clusters
   * @default 2
   */
  minClusterSize?: number

  /**
   * Maximum number of clusters to return
   * @default 20
   */
  maxClusters?: number
}

/**
 * Result of embedding generation for a test result
 */
export interface EmbeddingResult {
  testResultId: number
  success: boolean
  embedding?: Embedding
  error?: string
}

/**
 * Database row type for test_results with embedding
 */
export interface TestResultWithEmbedding {
  id: number
  execution_id: number
  test_name: string
  test_file: string
  status: string
  error_message: string | null
  stack_trace: string | null
  error_embedding: string | null // PostgreSQL vector stored as string
  ai_context: unknown | null
}

/**
 * Semantic search result for tests
 */
export interface SemanticSearchResult {
  testSignature: string
  testName: string
  testFile: string
  similarity: number
  lastStatus: string
  runCount: number
}
```

**Verification:**
- [ ] File created at `lib/ai/types.ts`
- [ ] Types exported for use in other modules

---

### Step 1.5: Create Index File

**File:** `lib/ai/index.ts`

```typescript
/**
 * AI utilities for Exolar QA
 *
 * Provides embedding generation and error sanitization for:
 * - Smart failure clustering
 * - Semantic test search
 */

// Re-export everything
export * from "./embeddings"
export * from "./sanitizer"
export * from "./types"
```

**Verification:**
- [ ] File created at `lib/ai/index.ts`
- [ ] All exports accessible via `import { ... } from "@/lib/ai"`

---

## Deliverables

| Item | Location | Status |
|------|----------|--------|
| Google Generative AI SDK | package.json | ⬜ |
| Embedding generator | `lib/ai/embeddings.ts` | ⬜ |
| Error sanitizer | `lib/ai/sanitizer.ts` | ⬜ |
| TypeScript types | `lib/ai/types.ts` | ⬜ |
| Index file | `lib/ai/index.ts` | ⬜ |

---

## Testing

**Manual Testing:**

```typescript
// In a Next.js API route or script
import { generateEmbedding, sanitizeErrorMessage, prepareErrorForEmbedding } from "@/lib/ai"

// Test sanitization
const raw = "TimeoutError at 2024-01-15T10:30:45Z: User abc-123-def not found"
const sanitized = sanitizeErrorMessage(raw)
console.log(sanitized)
// Expected: "TimeoutError at [TIMESTAMP]: User [UUID] not found"

// Test embedding generation
const embedding = await generateEmbedding("Test failure message")
console.log(`Embedding dimensions: ${embedding.length}`)
// Expected: Embedding dimensions: 768
```

**Unit Tests (Optional):**

```typescript
// __tests__/lib/ai/sanitizer.test.ts
import { sanitizeErrorMessage, extractErrorType } from "@/lib/ai"
import { describe, it, expect } from "vitest"

describe("sanitizeErrorMessage", () => {
  it("replaces UUIDs with placeholder", () => {
    const input = "User 123e4567-e89b-12d3-a456-426614174000 not found"
    expect(sanitizeErrorMessage(input)).toBe("User [UUID] not found")
  })

  it("replaces ISO timestamps", () => {
    const input = "Failed at 2024-01-15T10:30:45Z"
    expect(sanitizeErrorMessage(input)).toBe("Failed at [TIMESTAMP]")
  })

  it("replaces IP addresses", () => {
    const input = "Connection to 192.168.1.1 failed"
    expect(sanitizeErrorMessage(input)).toBe("Connection to [IP] failed")
  })
})

describe("extractErrorType", () => {
  it("extracts TimeoutError", () => {
    expect(extractErrorType("TimeoutError: test")).toBe("TimeoutError")
  })

  it("detects assertion errors from expect()", () => {
    expect(extractErrorType("expect(received).toBe(expected)")).toBe("AssertionError")
  })
})
```

---

## Next Phase

After completing Phase 1, proceed to [Phase 2: Ingestion Pipeline](./phase-2-ingestion-pipeline.md) to integrate embeddings into the test result ingestion flow.
