# PostgreSQL Batch Operations Optimization for Vector Embeddings

**Research Date:** 2026-01-13
**Focus:** Eliminating N+1 query patterns in vector embedding updates
**Database:** Neon Serverless PostgreSQL with pgvector extension

---

## Executive Summary

Current implementation uses N+1 UPDATE pattern (one query per embedding), which is inefficient. Research shows that **batch operations using temporary tables with COPY protocol can achieve 8-300x speedup** compared to individual UPDATE statements.

### Key Findings
- ✅ **COPY protocol:** 50-100k+ rows/sec vs 5-20k rows/sec for batch INSERT
- ✅ **Temp table pattern:** Dramatically faster for batch updates (data uploads to empty tables are much faster)
- ✅ **Batch size sweet spot:** 10,000-50,000 rows for optimal performance
- ✅ **Neon-specific:** Connection pooling critical (~100 connections per 1GB RAM)
- ⚠️ **COPY limitation:** Best for INSERT operations; UPDATE requires temp table workaround

---

## Problem: N+1 Query Pattern

**Current Code:**
```typescript
// ❌ BAD: N+1 pattern
for (const { testResultId, embedding } of valid) {
  await sql`
    UPDATE test_results
    SET error_embedding_v2 = ${JSON.stringify(embedding)}
    WHERE id = ${testResultId}
  `
}
```

**Issues:**
- One network round-trip per row
- Transaction overhead multiplied by N
- Index updates repeated N times
- WAL writes multiplied (~1.7x more data vs COPY)

---

## Solution 1: Temporary Table Pattern (RECOMMENDED)

### SQL Pattern

```typescript
// ✅ GOOD: Batch update via temp table
async function batchUpdateEmbeddings(
  updates: Array<{ testResultId: number; embedding: number[] }>
) {
  // Step 1: Create temp table
  await sql`
    CREATE TEMP TABLE embedding_updates (
      test_result_id INTEGER NOT NULL,
      embedding vector(768) NOT NULL
    ) ON COMMIT DROP
  `

  // Step 2: Bulk insert into temp table using VALUES
  const values = updates.map(u =>
    sql`(${u.testResultId}, ${JSON.stringify(u.embedding)}::vector)`
  )

  await sql`
    INSERT INTO embedding_updates (test_result_id, embedding)
    VALUES ${sql.join(values, ',')}
  `

  // Step 3: Batch UPDATE via JOIN
  await sql`
    UPDATE test_results t
    SET error_embedding_v2 = u.embedding
    FROM embedding_updates u
    WHERE t.id = u.test_result_id
  `
}
```

### Why This Works

1. **No network round-trips per row:** All data sent in one batch
2. **Single transaction:** Reduces overhead dramatically
3. **Efficient JOIN:** PostgreSQL optimizes batch UPDATE...FROM
4. **No repeated index updates:** Indexes updated once after batch completion
5. **Auto-cleanup:** `ON COMMIT DROP` removes temp table automatically

### Performance Benefits

- **8-10x faster** than individual UPDATEs for batches of 100+ rows
- **WAL savings:** ~1.7x less Write-Ahead Log data vs individual INSERT/UPDATE
- **Cache efficiency:** Better shared buffer utilization

---

## Solution 2: Batch UPDATE with CTE (Alternative)

For smaller batches (<1,000 rows), a CTE-based approach avoids temp table creation:

```typescript
async function batchUpdateEmbeddingsCTE(
  updates: Array<{ testResultId: number; embedding: number[] }>
) {
  const values = updates.map(u =>
    sql`(${u.testResultId}, ${JSON.stringify(u.embedding)}::vector)`
  )

  await sql`
    WITH update_data (test_result_id, embedding) AS (
      VALUES ${sql.join(values, ',')}
    )
    UPDATE test_results t
    SET error_embedding_v2 = u.embedding
    FROM update_data u
    WHERE t.id = u.test_result_id
  `
}
```

**Trade-offs:**
- ✅ Simpler (no temp table management)
- ✅ Good for smaller batches (100-1,000 rows)
- ⚠️ Less efficient than temp table for large batches (>10k rows)

---

## Solution 3: COPY Protocol (INSERT Only)

**Important:** COPY works for INSERT operations, not UPDATE. Use this pattern when inserting NEW embeddings:

```typescript
// For INSERT operations only
async function bulkInsertEmbeddings(
  rows: Array<{ testName: string; embedding: number[] }>
) {
  // Option 1: COPY FROM STDIN (text format)
  const copyText = rows
    .map(r => `${r.testName}\t${JSON.stringify(r.embedding)}`)
    .join('\n')

  await sql`
    COPY test_results (test_name, error_embedding_v2)
    FROM STDIN WITH (FORMAT TEXT)
  `
  // Note: Neon serverless driver doesn't support direct COPY FROM STDIN
  // Use temp table approach instead

  // Option 2: Temp table + batch INSERT (Neon-compatible)
  await sql`CREATE TEMP TABLE staging (
    test_name TEXT,
    embedding vector(768)
  ) ON COMMIT DROP`

  await sql`
    INSERT INTO staging (test_name, embedding)
    VALUES ${sql.join(
      rows.map(r => sql`(${r.testName}, ${JSON.stringify(r.embedding)}::vector)`),
      ','
    )}
  `

  await sql`
    INSERT INTO test_results (test_name, error_embedding_v2)
    SELECT test_name, embedding FROM staging
  `
}
```

---

## Performance Benchmarks

### INSERT Performance (100M rows)

| Method | Time (sec) | Rows/sec | Relative Speed |
|--------|------------|----------|----------------|
| COPY | 316 | 316,456 | **1x (baseline)** |
| Nested UNNEST | 533 | 187,618 | 1.7x slower |
| Batch INSERT (20k) | 2,653 | 37,693 | 8.4x slower |
| Single INSERT | 94,623 | 1,057 | **300x slower** |

**Source:** [Testing Postgres Ingest: INSERT vs. Batch INSERT vs. COPY](https://www.tigerdata.com/learn/testing-postgres-ingest-insert-vs-batch-insert-vs-copy)

### UPDATE Performance (Estimates)

| Method | Relative Speed | Notes |
|--------|----------------|-------|
| Temp table + batch UPDATE | **8-10x faster** | Recommended for >100 rows |
| CTE batch UPDATE | **5-8x faster** | Good for <1,000 rows |
| Individual UPDATEs | 1x (baseline) | Current N+1 pattern |

**Sources:**
- [Batch Update - The Art of PostgreSQL](https://tapoueh.org/blog/2013/03/batch-update/)
- [How to do batch updates in postgresql](https://minhajuddin.com/2020/10/17/how-to-do-batch-updates-in-postgresql/)

---

## Batch Size Recommendations

### Optimal Batch Sizes

| Batch Size | Performance | Use Case |
|------------|-------------|----------|
| 1-100 | Minimal benefit | Skip batching |
| 100-1,000 | **Good** | CTE approach |
| 1,000-10,000 | **Better** | Temp table recommended |
| 10,000-50,000 | **Optimal** | Sweet spot for throughput |
| 50,000+ | Diminishing returns | May cause memory pressure |

### Considerations

- **Neon connection limits:** ~100 connections per 1GB RAM
- **Maintenance work mem:** Increase for large batches (affects index updates)
- **Network bandwidth:** Larger batches = fewer round-trips but bigger payloads
- **Lock duration:** Larger batches hold locks longer (consider concurrency)

**Source:** [Performance tips for Neon Postgres](https://neon.com/blog/performance-tips-for-neon-postgres)

---

## pgvector-Specific Optimizations

### Index Management

```sql
-- ❌ BAD: Create index before bulk loading
CREATE INDEX ON test_results USING hnsw (error_embedding_v2 vector_cosine_ops);
-- Then insert 1M embeddings (SLOW!)

-- ✅ GOOD: Load data first, then create index
INSERT INTO test_results ... (bulk load 1M embeddings)
CREATE INDEX ON test_results USING hnsw (error_embedding_v2 vector_cosine_ops);
```

**Why:** Index creation is faster on bulk-loaded data. Real-time index updates during INSERT/UPDATE slow down writes significantly.

### Performance Tuning

```sql
-- Before bulk operations
SET maintenance_work_mem = '2GB';  -- Increase for faster index builds
SET max_parallel_maintenance_workers = 4;  -- Use more cores

-- Bulk update embeddings
-- (use temp table pattern from above)

-- Create/rebuild index
CREATE INDEX CONCURRENTLY idx_embeddings
ON test_results USING hnsw (error_embedding_v2 vector_cosine_ops);

-- Reset to defaults
RESET maintenance_work_mem;
RESET max_parallel_maintenance_workers;
```

**Source:** [pgvector GitHub](https://github.com/pgvector/pgvector)

---

## Neon Serverless Considerations

### Connection Pooling

```typescript
// ✅ Use Neon's serverless driver with connection pooling
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!, {
  poolQueryViaFetch: true,  // Use HTTP queries for better pooling
  fetchConnectionCache: true // Cache connections
})
```

**Neon-specific limits:**
- ~100 connections per 1GB RAM
- Autoscaling adjusts compute dynamically
- Use read replicas to offload non-write queries

**Source:** [Neon PostgreSQL Performance Guide](https://neon.com/blog/performance-tips-for-neon-postgres)

### Geographic Latency

- **Co-locate:** Run serverless functions in same region as Neon database
- **Batch aggressively:** Each network round-trip adds 10-50ms of latency
- **Use read replicas:** For queries that don't need latest data

### Database Branching for Testing

```bash
# Create test branch to benchmark batch operations
neonctl branches create --name test-batch-perf

# Run benchmark on branch
# Measure: current N+1 vs temp table approach

# If successful, merge changes to main
```

---

## Implementation Recommendations

### For Current Codebase

**Context:** Updating `error_embedding_v2` on `test_results` table after API embedding generation.

**Recommended Approach:**

```typescript
// lib/embeddings-batch.ts
import { sql } from '@neondatabase/serverless'

export async function batchUpdateTestEmbeddings(
  updates: Array<{ testResultId: number; embedding: number[] }>
) {
  if (updates.length === 0) return

  // For small batches, use CTE approach
  if (updates.length < 1000) {
    return batchUpdateEmbeddingsCTE(updates)
  }

  // For large batches, use temp table
  return batchUpdateEmbeddingsTemp(updates)
}

async function batchUpdateEmbeddingsCTE(
  updates: Array<{ testResultId: number; embedding: number[] }>
) {
  const values = updates.map(u =>
    sql`(${u.testResultId}, ${JSON.stringify(u.embedding)}::vector)`
  )

  await sql`
    WITH update_data (test_result_id, embedding) AS (
      VALUES ${sql.join(values, ',')}
    )
    UPDATE test_results t
    SET error_embedding_v2 = u.embedding
    FROM update_data u
    WHERE t.id = u.test_result_id
  `
}

async function batchUpdateEmbeddingsTemp(
  updates: Array<{ testResultId: number; embedding: number[] }>
) {
  // Create temp table (session-scoped, auto-dropped)
  await sql`
    CREATE TEMP TABLE IF NOT EXISTS embedding_updates (
      test_result_id INTEGER NOT NULL,
      embedding vector(768) NOT NULL
    ) ON COMMIT DROP
  `

  // Clear any existing data (shouldn't exist, but defensive)
  await sql`TRUNCATE embedding_updates`

  // Batch insert into temp table (chunk if >10k rows)
  const chunkSize = 10000
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize)
    const values = chunk.map(u =>
      sql`(${u.testResultId}, ${JSON.stringify(u.embedding)}::vector)`
    )

    await sql`
      INSERT INTO embedding_updates (test_result_id, embedding)
      VALUES ${sql.join(values, ',')}
    `
  }

  // Batch UPDATE via JOIN
  const result = await sql`
    UPDATE test_results t
    SET error_embedding_v2 = u.embedding
    FROM embedding_updates u
    WHERE t.id = u.test_result_id
  `

  return result.count // Number of rows updated
}
```

### Migration Strategy

1. **Add new batch function** (above code)
2. **Update calling code** to accumulate embeddings before updating
3. **Monitor performance** using `pg_stat_statements`
4. **Benchmark before/after** on production-like data volume
5. **Consider index recreation** if updating >1M embeddings

---

## Trade-offs and Considerations

### Batch vs Real-time

| Factor | N+1 UPDATEs | Batch Updates |
|--------|-------------|---------------|
| **Latency** | Low (immediate) | Higher (wait for batch) |
| **Throughput** | Low | **High** |
| **Memory** | Low | Moderate (batch size dependent) |
| **Lock duration** | Short per row | Longer per batch |
| **Complexity** | Simple | Moderate |

### When NOT to Batch

- **Real-time requirements:** Users expect <100ms updates
- **Very small volumes:** <10 rows per operation
- **High concurrency:** Batching may increase lock contention
- **Critical writes:** Prefer immediate durability over throughput

### Concurrency Handling

```sql
-- For high-concurrency scenarios, add explicit locking
BEGIN;

-- Prevent concurrent batch updates (optional)
LOCK TABLE test_results IN SHARE ROW EXCLUSIVE MODE;

-- Perform batch update
UPDATE test_results t
SET error_embedding_v2 = u.embedding
FROM embedding_updates u
WHERE t.id = u.test_result_id;

COMMIT;
```

**Source:** [Batch Updates and Concurrency](https://tapoueh.org/blog/2018/07/batch-updates-and-concurrency/)

---

## Expected Speedup for Your Use Case

### Scenario: Embedding 500 test failures

**Current (N+1):**
- 500 individual UPDATE statements
- ~5-10ms per UPDATE (network + execution)
- **Total: 2,500-5,000ms (2.5-5 seconds)**

**Optimized (temp table batch):**
- 1 temp table creation (~5ms)
- 1 batch INSERT (~50-100ms for 500 rows)
- 1 batch UPDATE (~100-200ms)
- **Total: ~155-305ms (0.15-0.3 seconds)**

**Speedup: 8-32x faster** 🚀

### Scenario: Daily embedding refresh (10,000 tests)

**Current (N+1):**
- 10,000 individual UPDATEs
- **Total: ~50-100 seconds**

**Optimized (temp table batch):**
- **Total: ~1-2 seconds**

**Speedup: 25-100x faster** 🚀

---

## Further Optimization Opportunities

### Parallel Batching

For very large datasets (>100k rows), consider parallel batch processing:

```typescript
async function parallelBatchUpdate(
  updates: Array<{ testResultId: number; embedding: number[] }>,
  concurrency = 4
) {
  const chunkSize = Math.ceil(updates.length / concurrency)
  const chunks = []

  for (let i = 0; i < updates.length; i += chunkSize) {
    chunks.push(updates.slice(i, i + chunkSize))
  }

  await Promise.all(
    chunks.map(chunk => batchUpdateTestEmbeddings(chunk))
  )
}
```

**Caution:** Monitor connection pool limits and lock contention.

### Incremental Updates

Instead of updating ALL embeddings, track which need updates:

```sql
-- Add tracking column
ALTER TABLE test_results
ADD COLUMN embedding_stale BOOLEAN DEFAULT true;

-- Only update stale embeddings
SELECT id, error_message
FROM test_results
WHERE embedding_stale = true
LIMIT 10000;

-- After batch update
UPDATE test_results
SET embedding_stale = false
WHERE id = ANY($1);
```

### Async Processing

For non-critical embedding updates, use job queue:

1. Insert test results immediately
2. Queue embedding generation job
3. Process embeddings in background batches
4. Update embeddings asynchronously

---

## Sources and References

### PostgreSQL Batch Operations
- [Update Large Datasets in PostgreSQL Efficiently | Creditsafe](https://medium.com/creditsafe/strategies-for-efficiently-updating-millions-of-records-in-postgresql-46afe980cf6b)
- [PostgreSQL: How to update large tables - in Postgres | Codacy](https://blog.codacy.com/how-to-update-large-tables-in-postgresql)
- [How Does PostgreSQL Implement Batch Update, Deletion, and Insertion? - Alibaba Cloud](https://www.alibabacloud.com/blog/how-does-postgresql-implement-batch-update-deletion-and-insertion_596030)
- [How to do batch updates in postgresql for really big updates](https://minhajuddin.com/2020/10/17/how-to-do-batch-updates-in-postgresql/)
- [Batch Updates and Concurrency - The Art of PostgreSQL](https://tapoueh.org/blog/2018/07/batch-updates-and-concurrency/)
- [Batch Update - The Art of PostgreSQL](https://tapoueh.org/blog/2013/03/batch-update/)
- [A 10x faster batch job by batching PostgreSQL inserts/updates with Rust](https://kerkour.com/postgresql-batching)

### pgvector
- [GitHub - pgvector/pgvector](https://github.com/pgvector/pgvector)
- [How to Create Vector Embeddings & Automatically Update - TigerData](https://www.tigerdata.com/blog/how-to-automatically-create-update-embeddings-in-postgresql)
- [pgvector: Key features, tutorial, and pros and cons [2026 guide]](https://www.instaclustr.com/education/vector-database/pgvector-key-features-tutorial-and-pros-and-cons-2026-guide/)
- [pgvector: Embeddings and vector similarity | Supabase Docs](https://supabase.com/docs/guides/database/extensions/pgvector)

### Neon Serverless PostgreSQL
- [Performance tips for Neon Postgres](https://neon.com/blog/performance-tips-for-neon-postgres)
- [Benchmarking latency in Neon's serverless Postgres](https://neon.com/docs/guides/benchmarking-latency)
- [GitHub - neondatabase/neon](https://github.com/neondatabase/neon)
- [Serverless Postgres with Neon: Simplifying Data Engineering Workflows](https://medium.com/@firmanbrilian/serverless-postgres-with-neon-simplifying-data-engineering-workflows-cdcbf77ff845)

### COPY vs INSERT Benchmarks
- [Testing Postgres Ingest: INSERT vs. Batch INSERT vs. COPY | TigerData](https://www.tigerdata.com/learn/testing-postgres-ingest-insert-vs-batch-insert-vs-copy)
- [Optimizing bulk loads in Postgres, and how COPY helps with cache performance](https://pganalyze.com/blog/5mins-postgres-optimizing-bulk-loads-copy-vs-insert)
- [Speed up your PostgreSQL bulk inserts with COPY - DEV Community](https://dev.to/josethz00/speed-up-your-postgresql-bulk-inserts-with-copy-40pk)
- [PostgreSQL: COPY vs Batch Insert — Which One Should You Use?](https://medium.com/@vishalpriyadarshi/postgresql-copy-vs-batch-insert-which-one-should-you-use-c96bc36c2765)
- [Faster bulk loading in Postgres with copy - Citus Data](https://www.citusdata.com/blog/2017/11/08/faster-bulk-loading-in-postgresql-with-copy/)

### Temp Table Patterns
- [Batch Update - The Art of PostgreSQL](https://tapoueh.org/blog/2013/03/batch-update/)
- [How to do batch updates in postgresql for really big updates](https://minhajuddin.com/2020/10/17/how-to-do-batch-updates-in-postgresql/)
- [How We Made PostgreSQL Upserts 300x Faster - TigerData](https://www.tigerdata.com/blog/how-we-made-postgresql-upserts-300x-faster-on-compressed-data)
- [Top Techniques to Enhance UPSERT Speed in PostgreSQL - RisingWave](https://risingwave.com/blog/top-techniques-to-enhance-upsert-speed-in-postgresql/)

---

## Conclusion

**Recommended Implementation:**

1. **Use temp table batch UPDATE pattern** for current use case (updating embeddings on existing rows)
2. **Target batch size:** 1,000-10,000 rows per batch
3. **Expected speedup:** 8-32x for typical workloads
4. **Neon-specific:** Leverage connection pooling, co-locate compute
5. **pgvector-specific:** Create indexes AFTER bulk embedding updates

**Next Steps:**

1. Implement `batchUpdateTestEmbeddings()` function
2. Refactor embedding generation to accumulate before updating
3. Benchmark on production-like dataset
4. Monitor `pg_stat_statements` for query performance
5. Consider async job queue for non-critical embedding updates
