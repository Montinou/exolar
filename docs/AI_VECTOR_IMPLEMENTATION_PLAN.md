# AI-Powered Test Analytics Strategy: Vector Implementation Plan

## 1. Executive Summary

This document illustrates the strategy to transform the **Exolar E2E Test Dashboard** from a passive monitoring tool into an **active intelligence engine**. By leveraging **NeonDB's native vector support (`pgvector`)** and **Google's Gemini 004 embeddings**, we will implement "Smart Failure Clustering" and "Semantic Test Search."

**Current State:**
- Failures are grouped by exact string matches (brittle).
- Investigations require manual correlation of logs.
- Search is keyword-dependent.

**Future State:**
- **AI-Driven Clustering:** System automatically groups 50 failures into "1 Root Cause" based on semantic similarity of error stacks.
- **Natural Language Search:** "Find checkout tests" returns `transaction_flow.spec.ts`.
- **Cost-Efficient:** Serverless architecture using existing Neon infrastructure.

---

## 2. Business Value Proposition

### 2.1. Reduced Time-to-Resolution (TTR)
*   **Problem:** A single API outage causes 200 tests to fail with slightly different error messages (timestamps, IDs). Engineers waste time triaging "noise."
*   **Solution:** Vector clustering identifies that all 200 errors are semantically 99% similar and maps them to a single issue cluster.
*   **Impact:** Triage time reduced from **hours to minutes**.

### 2.2. Enhanced Developer Experience
*   **Problem:** As the test suite grows (1000+ tests), finding specific coverage is difficult.
*   **Solution:** Semantic search allows developers to find tests by *intent* rather than *file name*.
*   **Impact:** Faster onboarding for new QA engineers; reduced duplicate test creation.

### 2.3. Proactive Flakiness Detection
*   **Problem:** Flaky tests often manifest with varying error signatures that regex misses.
*   **Solution:** Embeddings can detect if a qualified "Pass" was actually a "False Positive" or if a new flake signature matches a known historical pattern.
*   **Impact:** Higher confidence in deployment gates.

---

## 3. Technical Architecture

### 3.1. The AI Stack
*   **Database:** **NeonDB (PostgreSQL)**
    *   **Extension:** `pgvector`
    *   **Index:** `HNSW` (Hierarchical Navigable Small Worlds) for <10ms retrieval.
*   **Model Provider:** **Google Gemini**
    *   **Model:** `text-embedding-004`
    *   **Dimensions:** `768`
    *   **Why:** High performance, lower latency, large context window for stack traces.
*   **Framework:** **Next.js 16 (App Router)**
    *   **Integration:** Server Actions / API Routes.

### 3.2. Data Flow: "Smart Failure Clustering"

1.  **Ingestion:** Playwright test run completes. Results sent to `/api/ingest`.
2.  **Processing (Async):**
    *   System extracts `error_message` and `stack_trace`.
    *   **Sanitization:** Remove dynamic tokens (UUIDs, timestamps) to reduce noise.
    *   **Embedding:** Call `GoogleAI.embedContent(text)` $\rightarrow$ `[0.012, -0.93, ...]`.
3.  **Storage:** Save vector to `test_results` table in Neon.
4.  **Analysis:**
    *   Query: "Select top 5 clusters of failures for this Run ID."
    *   SQL: `ORDER BY embedding <-> current_embedding` (Cosine Distance).

---

## 4. Implementation Phases

### Phase 1: Infrastructure & Schema (Foundation)
*   Enable `pgvector` in Neon.
*   Update Prisma/Drizzle schema to support `vector(768)` type.
    *   *Note: Prisma has experimental vector support; might need raw SQL or typed-sql helpers.*
*   Integrate Google AI SDK for embedding generation.

### Phase 2: AI Failure Clustering (The MVP)
*   **Goal:** Group failures in the dashboard.
*   **UI:** Add "Smart Grouping" toggle on the Test Run Details page.
*   **Backend:** API route to fetch clustered failures using K-Means or simple distance thresholding (e.g., distance < 0.1).

### Phase 3: Semantic Test Search
*   **Goal:** Search bar upgrade.
*   **Batch Job:** Run a script to index all *existing* test file names and `test.describe` blocks.
*   **UI:** Replace simple text filter with vector search API.

---

## 5. Technical Specification

### 5.1. Database Schema (SQL)

```sql
-- Enable Extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Modify Results Table (Example)
ALTER TABLE "TestResult" 
ADD COLUMN "error_embedding" vector(768);

-- Create Index for Performance
-- HNSW is preferred over IVFFLAT for real-time recall
CREATE INDEX ON "TestResult" 
USING hnsw (error_embedding vector_cosine_ops);
```

### 5.2. Code Snippet: Generating Embeddings (TypeScript)

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

export async function generateEmbedding(text: string): Promise<number[]> {
  // Pre-process: truncation to fit token limits if necessary
  const result = await model.embedContent(text);
  return result.embedding.values;
}
```

### 5.3. Code Snippet: Similarity Search (Raw SQL via ORM)

```typescript
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Find similar failures
export async function findSimilarFailures(embedding: number[]) {
  // syntax: <-> is Euclidean distance, <=> is Cosine distance
  // For normalized embeddings, they are roughly equivalent in ranking
  const similar = await sql\`
    SELECT id, test_name, error_message,
           1 - (error_embedding <=> \${JSON.stringify(embedding)}::vector) as similarity
    FROM "TestResult"
    WHERE error_embedding IS NOT NULL
    ORDER BY error_embedding <=> \${JSON.stringify(embedding)}::vector
    LIMIT 10;
  \`;
  return similar;
}
```

## 6. Cost & Performance
*   **Neon Storage:** Vectors are small (~3KB per row). 100k failures = ~300MB. Negligible cost.
*   **Gemini API:** `text-embedding-004` is extremely cheap (pricing per 1M tokens).
    *   *Optimization:* Only embed *failed* tests (usually <5% of volume).
*   **Latency:** HNSW index lookup is sub-millisecond.

## 7. Next Steps
1.  **Approval:** Review this document.
2.  **Setup:** Configure `GOOGLE_API_KEY` in `.env`.
3.  **Execute Phase 1:** Run database migrations.
