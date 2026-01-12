# AI Vector Search Implementation Roadmap

> **Feature:** Smart Failure Clustering + Semantic Test Search
> **Status:** 🟡 Planning Complete
> **Created:** 2026-01-12
> **Last Updated:** 2026-01-12

## Overview

Transform Exolar QA from passive monitoring to an **active intelligence engine** using NeonDB's native `pgvector` support and Google Gemini `text-embedding-004` embeddings.

### Goals

1. **Smart Failure Clustering** - Automatically group 50+ failures into "1 Root Cause" clusters
2. **Semantic Test Search** - Find tests by intent ("checkout tests") not just file names
3. **Reduced Triage Time** - From hours to minutes for failure investigation

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Data Flow                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Playwright Test Run                                             │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────┐  │
│  │ /api/ingest  │───▶│ Sanitize Error  │───▶│ Gemini 004    │  │
│  │              │    │ (Remove UUIDs)  │    │ embedContent()│  │
│  └──────────────┘    └─────────────────┘    └───────────────┘  │
│                                                    │             │
│                                                    ▼             │
│                              ┌─────────────────────────────┐    │
│                              │ test_results                 │    │
│                              │ ├── error_message           │    │
│                              │ ├── stack_trace             │    │
│                              │ └── error_embedding vector(768)│ │
│                              └─────────────────────────────┘    │
│                                                    │             │
│         ┌──────────────────────────────────────────┘             │
│         ▼                                                        │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────┐  │
│  │ Similarity   │───▶│ K-Means /       │───▶│ Dashboard UI  │  │
│  │ Search       │    │ Distance Thresh │    │ Clustered View│  │
│  └──────────────┘    └─────────────────┘    └───────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Database | NeonDB PostgreSQL | Serverless, pgvector native |
| Vector Extension | pgvector | 768 dimensions |
| Index | HNSW | <10ms retrieval |
| Embedding Model | Gemini text-embedding-004 | 768 dims, high quality |
| Framework | Next.js 16 App Router | Server Actions / API Routes |

---

## Implementation Phases

| Phase | Name | Value Delivered | Est. Complexity |
|-------|------|-----------------|-----------------|
| **0** | [Database Foundation](./phases/phase-0-database-foundation.md) | pgvector enabled, schema ready | Low |
| **1** | [Embedding Infrastructure](./phases/phase-1-embedding-infrastructure.md) | Gemini SDK integrated, utilities ready | Low |
| **2** | [Ingestion Pipeline](./phases/phase-2-ingestion-pipeline.md) | New failures auto-embedded | Medium |
| **3** | [Clustering Backend](./phases/phase-3-clustering-backend.md) | API returns grouped failures | Medium |
| **4** | [Clustering UI](./phases/phase-4-clustering-ui.md) | Dashboard shows clustered failures | Medium |
| **5** | [Batch Indexing](./phases/phase-5-batch-indexing.md) | Existing tests searchable | Low |
| **6** | [Semantic Search Backend](./phases/phase-6-semantic-search-backend.md) | Natural language test search API | Medium |
| **7** | [Semantic Search UI](./phases/phase-7-semantic-search-ui.md) | Upgraded search experience | Low |
| **8** | [MCP Integration](./phases/phase-8-mcp-integration.md) | Claude Code can use features | Low |

---

## Phase Dependencies

```
Phase 0 ──▶ Phase 1 ──▶ Phase 2 ──┬──▶ Phase 3 ──▶ Phase 4
                                  │
                                  └──▶ Phase 5 ──▶ Phase 6 ──▶ Phase 7

Phase 4 + Phase 7 ──▶ Phase 8
```

**Critical Path:** 0 → 1 → 2 → 3 → 4 (Smart Clustering MVP)
**Parallel Track:** 5 → 6 → 7 (Semantic Search) can start after Phase 2

---

## Key Files Reference

### Database
- `scripts/015_add_vector_support.sql` - Enable pgvector + schema
- `lib/db/embeddings.ts` - Vector storage/retrieval functions
- `lib/db/clustering.ts` - Clustering algorithm

### Embedding
- `lib/ai/embeddings.ts` - Gemini SDK wrapper
- `lib/ai/sanitizer.ts` - Error message sanitization

### API
- `app/api/executions/[id]/clusters/route.ts` - Clustered failures endpoint
- `app/api/search/semantic/route.ts` - Semantic search endpoint

### UI
- `components/dashboard/failure-clusters.tsx` - Cluster visualization
- `components/dashboard/search-tests.tsx` - Enhanced search

### MCP
- `lib/mcp/handlers/query.ts` - Add clustered_failures dataset
- `lib/mcp/tools.ts` - Update tool definitions

---

## Environment Variables

**Required (already exists):**
```bash
GEMINIAI_API_KEY=xxx  # Google Gemini API key
DATABASE_URL=xxx      # Neon PostgreSQL connection
```

**No new variables needed** - uses existing infrastructure.

---

## Cost Analysis

| Resource | Usage | Monthly Cost |
|----------|-------|--------------|
| Neon Storage | ~3KB per vector × 100k failures = 300MB | ~$0.50 |
| Gemini API | text-embedding-004 per 1M tokens | ~$0.10 |
| **Total** | | **~$0.60/month** |

*Note: Only failed tests are embedded (~5% of total volume)*

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Triage time per failure batch | 30+ min | <5 min |
| Duplicate failure clusters identified | 0% | 90%+ |
| Test search accuracy | Exact match only | Intent-based |
| Developer onboarding (find relevant tests) | Hours | Minutes |

---

## Status Tracking

Use `docs/prompts/ai-vector-search/status.md` to track progress after each phase execution.

---

## Quick Start

```bash
# Phase 0: Run database migration
psql $DATABASE_URL -f scripts/015_add_vector_support.sql

# Phase 1: Install SDK
npm install @google/generative-ai

# Then follow each phase's detailed instructions
```
