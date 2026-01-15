# Query Caching Strategies for Vector Embedding Semantic Search

**Research Date:** 2026-01-13
**Context:** Exolar QA Dashboard - Jina v3 Embeddings (512-dim), Next.js + Vercel, Neon PostgreSQL

## Executive Summary

This document provides a comprehensive analysis of caching strategies for vector embedding queries in semantic search systems, with specific recommendations for the Exolar QA Dashboard's architecture.

**Key Recommendations:**
- **Two-layer caching**: Exact match (Redis/in-memory) + Semantic similarity (vector store)
- **TTL Strategy**: 1-7 days for query embeddings depending on query category
- **Cache Key**: `{model_version}:{normalized_query_hash}`
- **Architecture**: Redis for hot cache + PostgreSQL pgvector for semantic layer
- **Similarity Threshold**: 0.88-0.94 (tune per category)
- **Popular Query Precomputation**: Yes, for top 50-100 queries

---

## 1. Query Embedding Caching Fundamentals

### 1.1 What to Cache

**Query Embeddings** - Cache the vector representations of user queries:
- **Primary benefit**: Avoid re-computing embeddings for similar/identical queries
- **Cost savings**: Reduces embedding API calls by 60-70% ([Redis](https://redis.io/blog/what-is-semantic-caching/), [GPTCache](https://arxiv.org/html/2411.05276v2))
- **Latency reduction**: 186ms vs 3-5 seconds for uncached queries ([Dataquest](https://www.dataquest.io/blog/semantic-caching-and-memory-patterns-for-vector-databases/))

**Search Results** - Optionally cache the actual test failure results:
- Cache key: `{query_embedding_hash}:{filters}`
- TTL: Shorter (15-30 minutes) for real-time data
- Separate cache layer from embeddings

### 1.2 Two-Layer Caching Architecture

The industry standard is a **two-layer approach** ([Dataquest](https://www.dataquest.io/blog/semantic-caching-and-memory-patterns-for-vector-databases/)):

**Layer 1: Exact Match Cache (Fast Path)**
- Technology: Redis or in-memory Map
- Key: SHA-256 hash of normalized query
- Hit rate: 10-20% (identical queries)
- Latency: <5ms

**Layer 2: Semantic Cache (Similarity Path)**
- Technology: Vector store (Redis with vector search, PostgreSQL pgvector, or in-memory)
- Key: Query embedding (512-dim vector for Jina v3)
- Similarity threshold: 0.88-0.94 cosine similarity
- Hit rate: 40-60% (semantically similar queries)
- Latency: 10-50ms

**Combined**: 50-70% total hit rate ([Redis](https://redis.io/blog/10-techniques-for-semantic-cache-optimization/), [ArXiv](https://arxiv.org/html/2411.05276v2))

---

## 2. Cache Architecture Options

### 2.1 Architecture Comparison

| Architecture | Latency | Hit Rate | Complexity | Best For |
|--------------|---------|----------|------------|----------|
| **Redis Only** (exact + vector) | 5-20ms | 60-70% | Low | High-traffic, multi-region |
| **PostgreSQL pgvector** | 10-50ms | 50-60% | Medium | Existing Neon DB, serverless |
| **Hybrid** (Redis L1 + PG L2) | 5-50ms | 70-80% | High | Best performance |
| **In-Memory Only** | <5ms | 40-50% | Low | Single-region, budget constraints |

### 2.2 Recommended: Hybrid Architecture for Exolar QA

**Layer 1: Redis (Vercel KV or Upstash)**
- Exact match cache for identical queries
- 10K-50K query cache (estimate 5-25MB for 512-dim embeddings)
- TTL: 7 days
- Eviction: LRU (Least Recently Used)

**Layer 2: PostgreSQL pgvector (Neon)**
- Semantic similarity search on cached query embeddings
- Store: `query_text`, `embedding` (vector(512)), `created_at`, `access_count`
- Index: `CREATE INDEX ON query_cache USING hnsw (embedding vector_cosine_ops);`
- TTL: 30 days
- Cleanup: Weekly batch job

**Why Hybrid?**
- Already using Neon PostgreSQL (no new infrastructure)
- Vercel KV available for exact match layer
- Leverages both speed (Redis) and semantic search (pgvector)
- Cost-effective for serverless deployment

### 2.3 Alternative: PostgreSQL-Only Approach

Recent benchmarks show PostgreSQL can compete with Redis for moderate traffic ([DEV Community](https://dev.to/polliog/i-replaced-redis-with-postgresql-and-its-faster-4942), [Dizzy Zone](https://dizzy.zone/2025/09/24/Redis-is-fast-Ill-cache-in-Postgres/)):

**Pros:**
- Single database (reduced complexity)
- Good enough for <1M cache reads/day
- Combined key-value + vector search in one system
- Lower operational cost

**Cons:**
- Slower than Redis for exact match (10-30ms vs <5ms)
- Not ideal for millions of reads/sec
- Cold starts in serverless environments

**Recommendation for Exolar QA:** Start with PostgreSQL-only approach if Redis infrastructure isn't available, migrate to hybrid if latency becomes an issue.

---

## 3. Cache Key Design

### 3.1 Key Components

Correct cache keys capture **how** the answer was produced, not just the question ([Meilisearch](https://www.meilisearch.com/blog/how-to-cache-semantic-search), [Azure](https://learn.microsoft.com/en-us/azure/cosmos-db/gen-ai/semantic-cache)):

```typescript
interface CacheKey {
  modelVersion: string;        // e.g., "jina-v3"
  normalizedQuery: string;     // After preprocessing
  filters?: {                  // Optional context
    organizationId?: string;
    branch?: string;
    suite?: string;
  };
}

// Example key format:
// "jina-v3:sha256(timeout error login):org_123"
```

### 3.2 Query Normalization Process

**Step-by-step normalization** ([DEV Community](https://dev.to/mahakfaheem/redis-caching-in-rag-normalized-queries-semantic-traps-what-actually-worked-59nn), [Medium](https://medium.com/google-cloud/implementing-semantic-caching-a-step-by-step-guide-to-faster-cost-effective-genai-workflows-ef85d8e72883)):

1. **Lowercase**: `"Login Failed"` → `"login failed"`
2. **Strip filler phrases**: Remove "can you", "please", "tell me", "show me"
3. **Remove punctuation**: `"login-failed!"` → `"login failed"`
4. **Normalize whitespace**: Multiple spaces → single space
5. **Trim**: Remove leading/trailing whitespace
6. **Sort words** (optional): Helps with word order variations

**Example:**
```typescript
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/\b(can you|please|tell me|show me)\b/gi, '')
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
}

// "Please show me login failed errors!"
// → "login failed errors"
```

### 3.3 Hash Function

Use **SHA-256** for cache keys:
```typescript
import { createHash } from 'crypto';

function getCacheKey(
  query: string,
  modelVersion: string,
  filters?: Record<string, string>
): string {
  const normalized = normalizeQuery(query);
  const filterStr = filters ? JSON.stringify(filters) : '';
  const content = `${normalized}:${filterStr}`;
  const hash = createHash('sha256').update(content).digest('hex');

  return `${modelVersion}:${hash}`;
}
```

---

## 4. TTL Strategies

### 4.1 Category-Based TTL

Different query types have different freshness requirements ([Redis](https://redis.io/blog/10-techniques-for-semantic-cache-optimization/)):

| Query Category | TTL | Reasoning |
|----------------|-----|-----------|
| **Error patterns** | 7 days | Relatively stable; errors recur |
| **Test names** | 30 days | Rarely change |
| **Timeout errors** | 1 day | May be transient issues |
| **Login failures** | 3 days | Infrastructure-related, semi-stable |
| **Element not found** | 3 days | UI changes affect frequency |

### 4.2 Adaptive TTL Strategies

**Frequency-based TTL** ([Redis](https://redis.io/blog/10-techniques-for-semantic-cache-optimization/)):
- Popular queries (>10 accesses/day): 30 days
- Medium queries (2-10 accesses/day): 7 days
- Rare queries (1 access/day): 1 day

**Implementation:**
```typescript
function getAdaptiveTTL(accessCount: number): number {
  if (accessCount >= 10) return 30 * 24 * 60 * 60; // 30 days
  if (accessCount >= 2) return 7 * 24 * 60 * 60;   // 7 days
  return 24 * 60 * 60;                              // 1 day
}

// Update access count on cache hit
function onCacheHit(cacheKey: string) {
  const entry = getFromCache(cacheKey);
  entry.accessCount++;
  entry.ttl = getAdaptiveTTL(entry.accessCount);
  updateCache(cacheKey, entry);
}
```

### 4.3 Context-Aware TTL

For **real-time data** (test execution status):
- Recent executions: 15-30 minutes
- Completed executions: 1 hour
- Historical data: 24 hours

For **embeddings** (query vectors):
- Always longer TTL (7-30 days)
- Separate from result cache

---

## 5. Hit Rate Optimization

### 5.1 Strategies to Improve Cache Hit Rates

**1. Precompute Popular Queries**
- Identify top 50-100 queries from logs ([WWW 2003](http://www2003.org/cdrom/papers/refereed/p017/p17-lempel.html))
- Pre-generate embeddings for common patterns:
  - "timeout error"
  - "login failed"
  - "element not found"
  - "network error"
- Store in static cache (never expire)

**2. Query Clustering**
- Group similar queries using k-means or DBSCAN
- Pre-compute centroids for each cluster
- Map new queries to nearest centroid

**3. Synonyms and Aliases**
- Expand cache keys with synonyms:
  - "timeout" = "timed out" = "time exceeded"
  - "login" = "sign in" = "authentication"
- Store multiple keys pointing to same embedding

**4. Prefetching and Predictive Caching**
- Track query sequences (e.g., "login failed" often followed by "authentication error")
- Preload embeddings for likely next queries ([ResearchGate](https://www.researchgate.net/publication/221022697_Predictive_caching_and_prefetching_of_query_results_in_search_engines))

**5. Context Inclusion**
- Add chat history or session context to cache key ([Canonical](https://canonical.chat/blog/semantic_caching_faq))
- Improves accuracy but reduces hit rate (trade-off)

### 5.2 Monitoring and Tuning

**Key Metrics:**
- **Overall Hit Rate**: Target 60-70%
- **Layer 1 Hit Rate** (exact): Target 15-20%
- **Layer 2 Hit Rate** (semantic): Target 45-50%
- **Cache Miss Latency**: <200ms (embedding generation + search)

**Dashboard Example:**
```typescript
interface CacheMetrics {
  totalQueries: number;
  exactHits: number;         // Layer 1
  semanticHits: number;      // Layer 2
  misses: number;
  avgLatency: {
    exactHit: number;        // ~5ms
    semanticHit: number;     // ~20ms
    miss: number;            // ~200ms
  };
}
```

---

## 6. Stale Embedding Problem

### 6.1 Model Version Management

**Challenge:** When upgrading embedding models (e.g., Jina v3 → v4), old cached embeddings become incompatible ([Zilliz](https://zilliz.com/ai-faq/what-caching-strategies-work-best-for-embedding-generation), [Latitude](https://latitude-blog.ghost.io/blog/ultimate-guide-to-llm-caching-for-low-latency-ai/)).

**Solution: Version-Based Invalidation**

**1. Include Model Version in Cache Key**
```typescript
// Cache keys automatically namespace by model
const cacheKey = `jina-v3:${queryHash}`;

// After upgrade to v4:
const cacheKeyV4 = `jina-v4:${queryHash}`;
// Old v3 keys expire naturally via TTL
```

**2. Gradual Migration Strategy**
```typescript
async function migrateEmbeddings(oldVersion: string, newVersion: string) {
  // 1. Deploy new version without invalidating old cache
  // 2. New queries use new version
  // 3. Popular queries get recomputed in background
  // 4. Old keys expire via TTL over 7-30 days

  const popularQueries = await getTopQueries(100);
  for (const query of popularQueries) {
    const oldKey = `${oldVersion}:${hash(query)}`;
    const newKey = `${newVersion}:${hash(query)}`;

    const newEmbedding = await generateEmbedding(query, newVersion);
    await setCache(newKey, newEmbedding);
    // Keep old key until TTL expires
  }
}
```

**3. Feature Flag for Model Switching**
```typescript
const EMBEDDING_MODEL_VERSION = process.env.EMBEDDING_MODEL_VERSION || 'jina-v3';

async function getQueryEmbedding(query: string): Promise<number[]> {
  const cacheKey = `${EMBEDDING_MODEL_VERSION}:${hash(query)}`;

  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const embedding = await generateEmbedding(query, EMBEDDING_MODEL_VERSION);
  await setCache(cacheKey, embedding, TTL);
  return embedding;
}
```

### 6.2 Cache Invalidation Strategies

**Time-Based Expiration (TTL)**
- Primary strategy: Let old embeddings expire naturally
- Gradual rollover prevents cache stampede
- 7-30 day TTL gives smooth transition

**Event-Driven Invalidation**
- On model upgrade: Send event to invalidate specific prefixes
- Use pattern matching: `DEL jina-v3:*` (if using Redis)
- Risk: Complete cache flush → high load spike

**Hybrid Approach (Recommended)**
```typescript
async function onModelUpgrade(oldVersion: string, newVersion: string) {
  // 1. Update environment variable
  process.env.EMBEDDING_MODEL_VERSION = newVersion;

  // 2. Proactively migrate top 100 queries
  await migratePopularQueries(oldVersion, newVersion);

  // 3. Let remaining cache expire naturally via TTL
  // (Don't flush - causes thundering herd)
}
```

---

## 7. Popular Query Precomputation

### 7.1 Should You Precompute Embeddings?

**YES** - Research shows significant benefits ([WWW 2003](http://www2003.org/cdrom/papers/refereed/p017/p17-lempel.html), [AWS](https://aws.amazon.com/blogs/database/announcing-vector-search-for-amazon-elasticache/)):

**Benefits:**
- Static caches can achieve 30% hit rate on their own
- Combined with dynamic cache: 50%+ improvement
- Eliminates cold start latency for common queries
- Protects against cache flush/restart

**Trade-offs:**
- Storage overhead: ~2KB per embedding (512-dim float32)
- Maintenance: Need to identify popular queries periodically
- Staleness: May precompute queries that become irrelevant

### 7.2 Identifying Popular Queries

**Method 1: Log Analysis**
```sql
-- Analyze last 30 days of search queries
SELECT
  normalized_query,
  COUNT(*) as frequency,
  AVG(embedding_generation_time_ms) as avg_gen_time
FROM search_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY normalized_query
ORDER BY frequency DESC
LIMIT 100;
```

**Method 2: Topic-Based Precomputation**
Define categories and precompute representative queries:
```typescript
const PRECOMPUTED_QUERIES = {
  timeout: [
    "timeout error",
    "request timeout",
    "operation timed out",
    "connection timeout"
  ],
  login: [
    "login failed",
    "authentication error",
    "sign in failed",
    "credentials invalid"
  ],
  ui: [
    "element not found",
    "button not clickable",
    "selector not found",
    "element not visible"
  ]
};

async function precomputePopularQueries() {
  for (const [category, queries] of Object.entries(PRECOMPUTED_QUERIES)) {
    for (const query of queries) {
      const embedding = await generateEmbedding(query);
      await setCachePermanent(`precomputed:${category}:${hash(query)}`, embedding);
    }
  }
}
```

**Method 3: Hybrid Approach**
- Precompute top 50 queries from logs
- Add 50 manually curated error patterns
- Refresh weekly

### 7.3 Storage and Serving

**PostgreSQL Schema:**
```sql
CREATE TABLE popular_query_embeddings (
  id SERIAL PRIMARY KEY,
  query_text TEXT NOT NULL UNIQUE,
  normalized_query TEXT NOT NULL,
  embedding vector(512) NOT NULL,
  category VARCHAR(50),
  access_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  is_precomputed BOOLEAN DEFAULT true
);

CREATE INDEX idx_popular_embeddings ON popular_query_embeddings
USING hnsw (embedding vector_cosine_ops);
```

**Serving Strategy:**
```typescript
async function getEmbedding(query: string): Promise<number[]> {
  const normalized = normalizeQuery(query);

  // 1. Check exact match in precomputed cache (PostgreSQL or Redis)
  const precomputed = await db.query(
    'SELECT embedding FROM popular_query_embeddings WHERE normalized_query = $1',
    [normalized]
  );
  if (precomputed.rows[0]) {
    return precomputed.rows[0].embedding;
  }

  // 2. Check dynamic cache (Redis or in-memory)
  const cached = await redis.get(`cache:${hash(normalized)}`);
  if (cached) return JSON.parse(cached);

  // 3. Generate fresh embedding
  const embedding = await generateEmbedding(query);
  await redis.setex(`cache:${hash(normalized)}`, TTL, JSON.stringify(embedding));
  return embedding;
}
```

---

## 8. Vercel Edge Caching

### 8.1 Edge Caching Capabilities

Vercel Edge Caching supports **GET/HEAD requests** with `Cache-Control` headers ([Vercel Docs](https://vercel.com/docs/data-cache), [DEV Community](https://dev.to/melvinprince/leveraging-edge-caching-in-nextjs-with-vercel-for-ultra-low-latency-4a6)):

**How it works:**
- Set `Cache-Control: s-maxage=3600` in API response
- Vercel Edge Network caches response globally
- Subsequent requests served from nearest edge location (<50ms)

**Limitations for Semantic Search:**
- **POST requests not cached** (most search APIs use POST for large queries)
- **Authorization headers disable caching** (multi-tenant concern)
- **Dynamic filters** (org_id, branch, suite) reduce cache effectiveness
- **Semantic similarity** requires backend computation (can't cache at edge)

### 8.2 Hybrid Approach: Edge + Backend Cache

**Use Case 1: Popular Queries (GET endpoint)**
```typescript
// app/api/search/popular/[query]/route.ts
export const dynamic = 'force-static'; // Enable ISR

export async function GET(
  request: Request,
  { params }: { params: { query: string } }
) {
  const results = await searchPrecomputed(params.query);

  return new Response(JSON.stringify(results), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400'
    }
  });
}
```

**Use Case 2: Embeddings as Static Assets**
- Generate embeddings at build time for top 100 queries
- Store as JSON files in `/public/embeddings/`
- Serve via CDN (Vercel Edge Network)
- Client-side cosine similarity (for non-sensitive searches)

**Example:**
```bash
# Build-time generation
npm run generate-embeddings  # Outputs to public/embeddings/

# Client fetches:
# https://exolar.vercel.app/embeddings/timeout-error.json
```

### 8.3 Recommended Strategy for Exolar QA

**Don't rely on Vercel Edge Caching for semantic search:**
- Use **Redis/PostgreSQL for embedding cache** (works with POST + auth)
- Reserve edge caching for **static assets** (precomputed embeddings)
- Use **Next.js Data Cache** for server-side caching (App Router feature)

**Next.js App Router Caching:**
```typescript
// app/api/search/route.ts
import { unstable_cache } from 'next/cache';

const getCachedEmbedding = unstable_cache(
  async (query: string) => {
    return await generateEmbedding(query);
  },
  ['embedding-cache'],
  {
    revalidate: 604800, // 7 days
    tags: ['embeddings']
  }
);

export async function POST(request: Request) {
  const { query } = await request.json();
  const embedding = await getCachedEmbedding(query); // Cached!
  // ... rest of search logic
}
```

---

## 9. Cosine Similarity Threshold Tuning

### 9.1 Recommended Starting Points

Based on production data and research ([Redis](https://redis.io/blog/10-techniques-for-semantic-cache-optimization/), [DEV Community](https://dev.to/roiting_hacking_4d8d76800/stop-burning-money-implementing-semantic-caching-for-llms-with-redis-cosine-similarity-53a5)):

| Use Case | Threshold | Precision | Hit Rate | Reasoning |
|----------|-----------|-----------|----------|-----------|
| **FAQ (high risk)** | 0.94 | 98% | 40-50% | Wrong answers damage trust |
| **Error search** | 0.88 | 85-90% | 60-70% | Missing cache hit just costs latency |
| **Test names** | 0.90 | 90-95% | 50-60% | Moderate precision needed |
| **General queries** | 0.85 | 80-85% | 70-80% | Exploration use case |

### 9.2 Category-Specific Thresholds

**Don't use a global threshold** ([Redis](https://redis.io/blog/10-techniques-for-semantic-cache-optimization/)):

```typescript
const SIMILARITY_THRESHOLDS = {
  timeout_errors: 0.88,      // Broad semantic match OK
  login_failures: 0.92,      // Security-related, higher precision
  test_names: 0.90,          // Exact match preferred
  ui_errors: 0.85,           // Many variations acceptable
  general: 0.88              // Default
};

function getThreshold(queryCategory: string): number {
  return SIMILARITY_THRESHOLDS[queryCategory] || SIMILARITY_THRESHOLDS.general;
}

async function semanticSearch(
  queryEmbedding: number[],
  category: string
): Promise<CachedResult | null> {
  const threshold = getThreshold(category);

  const result = await db.query(`
    SELECT *, 1 - (embedding <=> $1::vector) as similarity
    FROM query_cache
    WHERE 1 - (embedding <=> $1::vector) > $2
    ORDER BY similarity DESC
    LIMIT 1
  `, [queryEmbedding, threshold]);

  return result.rows[0] || null;
}
```

### 9.3 Dynamic Threshold Adjustment

**Method 1: F-Score Optimization**
- Collect labeled data (true hits vs false hits)
- Calculate F-score for different thresholds
- Choose threshold that maximizes F-score ([ArXiv](https://arxiv.org/html/2411.05276v2))

**Method 2: A/B Testing**
```typescript
// Gradually lower threshold and monitor precision
const THRESHOLD_EXPERIMENTS = {
  control: 0.90,
  variant_a: 0.88,
  variant_b: 0.85
};

function getExperimentalThreshold(userId: string): number {
  const bucket = hash(userId) % 3;
  return Object.values(THRESHOLD_EXPERIMENTS)[bucket];
}
```

**Method 3: User Feedback Loop**
```typescript
interface CacheHit {
  queryEmbedding: number[];
  cachedQuery: string;
  similarity: number;
  wasHelpful?: boolean; // User feedback
}

// Adjust threshold based on feedback
async function adjustThreshold(category: string) {
  const hits = await db.query(`
    SELECT similarity, was_helpful
    FROM cache_feedback
    WHERE category = $1 AND was_helpful IS NOT NULL
  `, [category]);

  // Calculate optimal threshold (e.g., 95th percentile of helpful hits)
  const helpfulSimilarities = hits.rows
    .filter(r => r.was_helpful)
    .map(r => r.similarity)
    .sort((a, b) => a - b);

  const p5 = helpfulSimilarities[Math.floor(helpfulSimilarities.length * 0.05)];
  return Math.max(0.80, p5); // Never go below 0.80
}
```

---

## 10. Implementation Approach for Next.js + Vercel

### 10.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      User Query                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Layer 1: Exact Match Cache (Redis)              │
│              Key: sha256(normalized_query)                   │
│              TTL: 7 days, Eviction: LRU                     │
│              Hit: Return cached embedding (~5ms)             │
└────────────────────────┬────────────────────────────────────┘
                         │ Miss
                         ▼
┌─────────────────────────────────────────────────────────────┐
│          Layer 2: Semantic Cache (PostgreSQL pgvector)       │
│          Query: SELECT ... WHERE cosine_similarity > 0.88    │
│          Hit: Return similar cached embedding (~20ms)        │
└────────────────────────┬────────────────────────────────────┘
                         │ Miss
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Layer 3: Generate Fresh Embedding               │
│              Call Jina API (~200ms)                          │
│              Store in Redis + PostgreSQL                     │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Code Implementation

**Step 1: Database Schema**
```sql
-- PostgreSQL (Neon) with pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Semantic cache table
CREATE TABLE query_embedding_cache (
  id SERIAL PRIMARY KEY,
  organization_id VARCHAR(255) NOT NULL,
  query_text TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  embedding vector(512) NOT NULL,
  model_version VARCHAR(50) NOT NULL DEFAULT 'jina-v3',
  access_count INTEGER DEFAULT 1,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  last_accessed_at TIMESTAMP DEFAULT NOW(),
  ttl_expires_at TIMESTAMP NOT NULL
);

-- Indexes
CREATE INDEX idx_org_normalized ON query_embedding_cache(organization_id, normalized_query);
CREATE INDEX idx_embedding_similarity ON query_embedding_cache
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_ttl ON query_embedding_cache(ttl_expires_at);

-- Popular queries (precomputed)
CREATE TABLE popular_queries (
  id SERIAL PRIMARY KEY,
  query_text TEXT NOT NULL UNIQUE,
  normalized_query TEXT NOT NULL,
  embedding vector(512) NOT NULL,
  category VARCHAR(50),
  priority INTEGER DEFAULT 0
);
```

**Step 2: Cache Service**
```typescript
// lib/cache/query-embedding-cache.ts
import { Redis } from '@upstash/redis';
import { sql } from '@vercel/postgres';
import { createHash } from 'crypto';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!
});

const MODEL_VERSION = 'jina-v3';
const DEFAULT_TTL_DAYS = 7;
const SIMILARITY_THRESHOLD = 0.88;

interface CachedEmbedding {
  embedding: number[];
  queryText: string;
  similarity?: number;
  source: 'exact' | 'semantic' | 'precomputed' | 'fresh';
}

// Query normalization
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/\b(can you|please|tell me|show me|find)\b/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Cache key generation
function getCacheKey(query: string, orgId: string): string {
  const normalized = normalizeQuery(query);
  const hash = createHash('sha256')
    .update(`${orgId}:${normalized}`)
    .digest('hex')
    .substring(0, 16);
  return `${MODEL_VERSION}:${hash}`;
}

// Layer 1: Exact match (Redis)
async function getExactMatch(
  query: string,
  orgId: string
): Promise<CachedEmbedding | null> {
  const key = getCacheKey(query, orgId);
  const cached = await redis.get(key);

  if (!cached) return null;

  const data = JSON.parse(cached as string);
  return {
    embedding: data.embedding,
    queryText: data.queryText,
    source: 'exact'
  };
}

// Layer 2: Semantic similarity (PostgreSQL)
async function getSemanticMatch(
  queryEmbedding: number[],
  orgId: string,
  threshold: number = SIMILARITY_THRESHOLD
): Promise<CachedEmbedding | null> {
  const result = await sql`
    SELECT
      query_text,
      embedding,
      1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
    FROM query_embedding_cache
    WHERE
      organization_id = ${orgId}
      AND ttl_expires_at > NOW()
      AND 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) > ${threshold}
    ORDER BY similarity DESC
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];

  // Update access count
  await sql`
    UPDATE query_embedding_cache
    SET
      access_count = access_count + 1,
      last_accessed_at = NOW()
    WHERE query_text = ${row.query_text}
      AND organization_id = ${orgId}
  `;

  return {
    embedding: row.embedding,
    queryText: row.query_text,
    similarity: row.similarity,
    source: 'semantic'
  };
}

// Layer 3: Generate fresh embedding
async function generateEmbedding(query: string): Promise<number[]> {
  const response = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.JINA_API_KEY}`
    },
    body: JSON.stringify({
      model: 'jina-embeddings-v3',
      task: 'text-matching',
      dimensions: 512,
      late_chunking: false,
      embedding_type: 'float',
      input: [query]
    })
  });

  const data = await response.json();
  return data.data[0].embedding;
}

// Store in both caches
async function storeInCache(
  query: string,
  embedding: number[],
  orgId: string,
  ttlDays: number = DEFAULT_TTL_DAYS
) {
  const normalized = normalizeQuery(query);
  const cacheKey = getCacheKey(query, orgId);
  const ttlSeconds = ttlDays * 24 * 60 * 60;

  // Store in Redis (Layer 1)
  await redis.setex(
    cacheKey,
    ttlSeconds,
    JSON.stringify({ embedding, queryText: query })
  );

  // Store in PostgreSQL (Layer 2)
  await sql`
    INSERT INTO query_embedding_cache (
      organization_id,
      query_text,
      normalized_query,
      embedding,
      model_version,
      ttl_expires_at
    ) VALUES (
      ${orgId},
      ${query},
      ${normalized},
      ${JSON.stringify(embedding)}::vector,
      ${MODEL_VERSION},
      NOW() + INTERVAL '${ttlDays} days'
    )
    ON CONFLICT (organization_id, query_text)
    DO UPDATE SET
      access_count = query_embedding_cache.access_count + 1,
      last_accessed_at = NOW()
  `;
}

// Main function: Get or generate embedding
export async function getQueryEmbedding(
  query: string,
  orgId: string,
  category?: string
): Promise<CachedEmbedding> {
  // Check precomputed queries first (popular patterns)
  const precomputed = await sql`
    SELECT embedding, query_text
    FROM popular_queries
    WHERE normalized_query = ${normalizeQuery(query)}
    LIMIT 1
  `;

  if (precomputed.rows.length > 0) {
    return {
      embedding: precomputed.rows[0].embedding,
      queryText: precomputed.rows[0].query_text,
      source: 'precomputed'
    };
  }

  // Layer 1: Check exact match
  const exactMatch = await getExactMatch(query, orgId);
  if (exactMatch) return exactMatch;

  // Generate embedding for semantic search
  const queryEmbedding = await generateEmbedding(query);

  // Layer 2: Check semantic similarity
  const threshold = category ? getThresholdForCategory(category) : SIMILARITY_THRESHOLD;
  const semanticMatch = await getSemanticMatch(queryEmbedding, orgId, threshold);
  if (semanticMatch) return semanticMatch;

  // Layer 3: Use fresh embedding and cache it
  await storeInCache(query, queryEmbedding, orgId);

  return {
    embedding: queryEmbedding,
    queryText: query,
    source: 'fresh'
  };
}

// Category-specific thresholds
function getThresholdForCategory(category: string): number {
  const thresholds: Record<string, number> = {
    timeout_errors: 0.88,
    login_failures: 0.92,
    test_names: 0.90,
    ui_errors: 0.85
  };
  return thresholds[category] || SIMILARITY_THRESHOLD;
}

// Metrics tracking
export async function getCacheMetrics(orgId: string) {
  const result = await sql`
    SELECT
      COUNT(*) as total_queries,
      AVG(access_count) as avg_access_count,
      COUNT(CASE WHEN access_count > 10 THEN 1 END) as popular_queries,
      COUNT(CASE WHEN ttl_expires_at < NOW() THEN 1 END) as expired_queries
    FROM query_embedding_cache
    WHERE organization_id = ${orgId}
  `;

  return result.rows[0];
}

// Cleanup expired entries
export async function cleanupExpiredCache() {
  await sql`
    DELETE FROM query_embedding_cache
    WHERE ttl_expires_at < NOW()
  `;
}
```

**Step 3: API Route**
```typescript
// app/api/search/semantic/route.ts
import { getQueryEmbedding } from '@/lib/cache/query-embedding-cache';
import { getSessionContext } from '@/lib/session-context';
import { searchTestsBySimilarity } from '@/lib/db';

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { query, filters } = await request.json();

  // Get cached or fresh embedding
  const startTime = Date.now();
  const { embedding, source } = await getQueryEmbedding(
    query,
    context.organizationId
  );
  const embeddingTime = Date.now() - startTime;

  // Search using embedding
  const results = await searchTestsBySimilarity(
    embedding,
    context.organizationId,
    filters
  );

  return Response.json({
    results,
    meta: {
      cacheSource: source,
      embeddingLatency: embeddingTime,
      totalLatency: Date.now() - startTime
    }
  });
}
```

### 10.3 Background Jobs

**Cron Job: Cleanup Expired Cache**
```typescript
// app/api/cron/cleanup-cache/route.ts
import { cleanupExpiredCache } from '@/lib/cache/query-embedding-cache';

export async function GET(request: Request) {
  // Verify cron secret (Vercel Cron)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  await cleanupExpiredCache();
  return Response.json({ success: true });
}
```

**Vercel Cron Configuration** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-cache",
      "schedule": "0 0 * * 0"
    }
  ]
}
```

**Precompute Popular Queries Script:**
```typescript
// scripts/precompute-embeddings.ts
import { sql } from '@vercel/postgres';

const POPULAR_QUERIES = [
  { text: 'timeout error', category: 'timeout_errors' },
  { text: 'login failed', category: 'login_failures' },
  { text: 'element not found', category: 'ui_errors' },
  { text: 'network error', category: 'network' },
  { text: 'authentication failed', category: 'login_failures' }
];

async function precomputeEmbeddings() {
  for (const query of POPULAR_QUERIES) {
    const embedding = await generateEmbedding(query.text);

    await sql`
      INSERT INTO popular_queries (query_text, normalized_query, embedding, category)
      VALUES (
        ${query.text},
        ${normalizeQuery(query.text)},
        ${JSON.stringify(embedding)}::vector,
        ${query.category}
      )
      ON CONFLICT (query_text) DO NOTHING
    `;
  }

  console.log(`Precomputed ${POPULAR_QUERIES.length} embeddings`);
}

precomputeEmbeddings();
```

---

## 11. Trade-offs Summary

| Strategy | Freshness | Performance | Cost | Complexity |
|----------|-----------|-------------|------|------------|
| **No caching** | Perfect | Slow (200ms+) | High API costs | Low |
| **Redis only (exact)** | Good (7d TTL) | Fast (5ms) | Medium | Low |
| **PostgreSQL semantic** | Good (7-30d) | Medium (20ms) | Low | Medium |
| **Hybrid (Redis + PG)** | Good | Fast (5-20ms) | Medium | High |
| **Precomputed popular** | Static | Fastest (1ms) | Very low | Medium |
| **Vercel Edge** | Static | Fastest (<50ms) | Free | Low (limited use) |

### Recommended Configuration for Exolar QA

**Phase 1: PostgreSQL-Only (MVP)**
- Start simple: Single database for embeddings + search
- TTL: 7 days for query embeddings
- Threshold: 0.88 (tune per category later)
- Precompute top 50 queries
- Expected hit rate: 50-60%

**Phase 2: Add Redis Layer (Scale)**
- Add Vercel KV for exact match cache
- Keep PostgreSQL for semantic layer
- Expected hit rate: 70-80%
- Latency improvement: 5ms vs 20ms for cache hits

**Phase 3: Optimization (Production)**
- Adaptive TTLs based on access frequency
- Category-specific similarity thresholds
- A/B testing for threshold optimization
- User feedback loop

---

## 12. Implementation Checklist

- [ ] **Database Setup**
  - [ ] Enable pgvector extension in Neon
  - [ ] Create `query_embedding_cache` table
  - [ ] Create `popular_queries` table
  - [ ] Add HNSW index on embeddings

- [ ] **Cache Service**
  - [ ] Implement query normalization function
  - [ ] Implement cache key generation (SHA-256 hash)
  - [ ] Layer 1: Redis exact match (optional, start without)
  - [ ] Layer 2: PostgreSQL semantic search
  - [ ] Layer 3: Jina API embedding generation
  - [ ] Store embeddings in both layers

- [ ] **Caching Logic**
  - [ ] Set TTL to 7 days initially
  - [ ] Use cosine similarity threshold 0.88
  - [ ] Include model version in cache key
  - [ ] Track access count for adaptive TTL

- [ ] **Popular Queries**
  - [ ] Identify top 50-100 queries from logs
  - [ ] Precompute embeddings for popular patterns
  - [ ] Store in `popular_queries` table
  - [ ] Update weekly via cron job

- [ ] **API Integration**
  - [ ] Update semantic search endpoint to use cache
  - [ ] Return cache metadata (source, latency)
  - [ ] Log cache hits/misses for monitoring

- [ ] **Monitoring**
  - [ ] Track cache hit rate (overall, per layer)
  - [ ] Monitor embedding generation latency
  - [ ] Alert if hit rate drops below 50%
  - [ ] Dashboard for cache metrics

- [ ] **Maintenance**
  - [ ] Cron job for expired cache cleanup (weekly)
  - [ ] Script to refresh popular queries (weekly)
  - [ ] Model version migration plan
  - [ ] Cache invalidation strategy on model upgrade

- [ ] **Testing**
  - [ ] Unit tests for normalization
  - [ ] Integration tests for cache layers
  - [ ] Load testing with realistic query distribution
  - [ ] Verify multi-tenant isolation

---

## 13. Sources & References

### Semantic Caching Fundamentals
- [Semantic Caching and Memory Patterns for Vector Databases – Dataquest](https://www.dataquest.io/blog/semantic-caching-and-memory-patterns-for-vector-databases/)
- [What is semantic caching? | Redis](https://redis.io/blog/what-is-semantic-caching/)
- [Semantic Caching Explained | QualityPoint Technologies](https://www.blog.qualitypointtech.com/2025/12/semantic-caching-explained-complete.html)

### Redis Caching Strategies
- [Caching Embeddings | Redis Docs](https://redis.io/docs/latest/develop/ai/redisvl/user_guide/embeddings_cache/)
- [10 techniques to optimize your semantic cache with Redis LangCache](https://redis.io/blog/10-techniques-for-semantic-cache-optimization/)
- [What's the best embedding model for semantic caching? | Redis](https://redis.io/blog/whats-the-best-embedding-model-for-semantic-caching/)
- [Building a Context-Enabled Semantic Cache with Redis](https://redis.io/blog/building-a-context-enabled-semantic-cache-with-redis/)

### TTL & Cache Invalidation
- [LLM Caching Strategies | Reintech](https://reintech.io/blog/how-to-implement-llm-caching-strategies-for-faster-response-times)
- [Ultimate Guide to LLM Caching | Latitude](https://latitude-blog.ghost.io/blog/ultimate-guide-to-llm-caching-for-low-latency-ai/)
- [Cache Invalidation Strategies | Medium](https://softbuilds.medium.com/cache-invalidation-strategies-that-dont-bite-you-later-bde3415687e5)
- [What caching strategies work best for embedding generation? | Zilliz](https://zilliz.com/ai-faq/what-caching-strategies-work-best-for-embedding-generation)

### Query Normalization & Cache Keys
- [Implementing Semantic Caching | Google Cloud](https://medium.com/google-cloud/implementing-semantic-caching-a-step-by-step-guide-to-faster-cost-effective-genai-workflows-ef85d8e72883)
- [How to cache semantic search | Meilisearch](https://www.meilisearch.com/blog/how-to-cache-semantic-search)
- [Redis Caching in RAG | DEV Community](https://dev.to/mahakfaheem/redis-caching-in-rag-normalized-queries-semantic-traps-what-actually-worked-59nn)
- [Semantic Cache for Large Language Models | Azure](https://learn.microsoft.com/en-us/azure/cosmos-db/gen-ai/semantic-cache)

### Popular Query Precomputation
- [Predictive Caching and Prefetching of Query Results | WWW 2003](http://www2003.org/cdrom/papers/refereed/p017/p17-lempel.html)
- [GPT Semantic Cache | ArXiv](https://arxiv.org/html/2411.05276v2)
- [Announcing vector search for Amazon ElastiCache | AWS](https://aws.amazon.com/blogs/database/announcing-vector-search-for-amazon-elasticache/)

### Vercel Edge Caching
- [Leveraging Edge Caching in Next.js with Vercel | DEV Community](https://dev.to/melvinprince/leveraging-edge-caching-in-nextjs-with-vercel-for-ultra-low-latency-4a6)
- [Vercel Data Cache | Vercel Blog](https://vercel.com/blog/vercel-cache-api-nextjs-cache)
- [Data Cache for Next.js | Vercel Docs](https://vercel.com/docs/data-cache)

### Architecture Comparisons
- [Redis is fast - I'll cache in Postgres | Dizzy Zone](https://dizzy.zone/2025/09/24/Redis-is-fast-Ill-cache-in-Postgres/)
- [I Replaced Redis with PostgreSQL | DEV Community](https://dev.to/polliog/i-replaced-redis-with-postgresql-and-its-faster-4942)
- [PostgreSQL vs Redis vs Memcached performance | CYBERTEC](https://www.cybertec-postgresql.com/en/postgresql-vs-redis-vs-memcached-performance/)

### Cosine Similarity Threshold Tuning
- [10 techniques to optimize your semantic cache | Redis](https://redis.io/blog/10-techniques-for-semantic-cache-optimization/)
- [Stop Burning Money: Implementing Semantic Caching | DEV Community](https://dev.to/roiting_hacking_4d8d76800/stop-burning-money-implementing-semantic-caching-for-llms-with-redis-cosine-similarity-53a5)
- [Rule of thumb cosine similarity thresholds? | OpenAI Community](https://community.openai.com/t/rule-of-thumb-cosine-similarity-thresholds/693670)
- [Why your LLM bill is exploding | VentureBeat](https://venturebeat.com/orchestration/why-your-llm-bill-is-exploding-and-how-semantic-caching-can-cut-it-by-73)

### Additional Resources
- [MeanCache: User-Centric Semantic Cache | ArXiv](https://arxiv.org/html/2403.02694v3)
- [Semantic Cache for AI Data Retrieval | Qdrant](https://qdrant.tech/articles/semantic-cache-ai-data-retrieval/)
- [Upstash Semantic Cache | GitHub](https://github.com/upstash/semantic-cache)
- [GPTCache | GitHub](https://github.com/zilliztech/GPTCache)
- [RAGCache | EmergentMind](https://www.emergentmind.com/topics/ragcache)

---

**Document Version:** 1.0
**Last Updated:** 2026-01-13
**Next Review:** 2026-02-13
