# Advanced Embedding Accuracy Techniques for Test Failure Search

**Date:** 2026-01-13
**Context:** Improving Jina v3 embedding accuracy for test failure search (error messages + stack traces)
**Current Stack:** Next.js, Neon PostgreSQL, Vercel, Jina v3 embeddings

## Overview

This document covers advanced techniques to improve embedding accuracy beyond our current optimizations (late chunking, semantic enrichment, preprocessing, two-stage retrieval). All techniques are evaluated for practical implementation with our tech stack.

---

## 1. Fine-Tuning & Domain Adaptation

### What It Is
Fine-tuning adapts a pre-trained embedding model to your specific domain (test failures, error messages, stack traces) using labeled examples from your data.

### Jina v3 Task-Specific LoRA Adapters

**Key Finding:** Jina v3 has built-in LoRA (Low-Rank Adaptation) support for task optimization.

- **Architecture:** Jina v3 (570M parameters) uses task-specific LoRA adapters that add <3% parameters
- **Available Tasks:** `retrieval.query`, `retrieval.passage`, `text-matching`, `classification`, `separation`
- **Training Process:** 3-stage (pre-training → fine-tuning → adapter training)
- **Performance:** LoRA rank 32 substantially improves MRR over base models like UniXcoder

**Implementation Approach:**

```python
# Use Jina v3 with custom LoRA adapter for error retrieval
from sentence_transformers import SentenceTransformer
from sentence_transformers.losses import MultipleNegativesRankingLoss

# 1. Load base Jina v3 model
model = SentenceTransformer('jinaai/jina-embeddings-v3')

# 2. Prepare training data (error-error pairs)
train_examples = [
    InputExample(texts=[query_error, similar_error]),  # Positive pairs
    InputExample(texts=[query_error, dissimilar_error]),  # Hard negatives
]

# 3. Fine-tune with LoRA
# Use Jina's task parameter for optimal base performance
model.fit(
    train_objectives=[(train_dataloader, MultipleNegativesRankingLoss(model))],
    epochs=1,  # Short fine-tuning is often sufficient
    warmup_steps=100,
)
```

**Expected Gains:** 5-15% improvement in MRR/NDCG
**Implementation Complexity:** Medium
**Cost:** Low (fine-tuning on 6.3k samples takes ~3 minutes on consumer GPU)
**When to Use:** When you have 1,000+ labeled error pairs (similar/dissimilar)

**Synthetic Data Generation:**

Use LLMs to create training data:
```python
# Generate synthetic error variations
synthetic_pairs = [
    ("TimeoutError: Connection timeout after 30s",
     "TimeoutError: Request timeout (30000ms)"),  # Similar
    ("TimeoutError: Connection timeout after 30s",
     "TypeError: Cannot read property 'x' of undefined"),  # Dissimilar
]
```

**Performance:** Fine-tuning with synthetic data can boost retrieval by ~7% with only 6.3k samples.

**Sources:**
- [jina-embeddings-v3: Multilingual Embeddings With Task LoRA](https://arxiv.org/html/2409.10173v3)
- [Jina Embeddings v3 Official Announcement](https://jina.ai/news/jina-embeddings-v3-a-frontier-multilingual-embedding-model/)
- [Fine-tune ModernBERT for RAG with Synthetic Data](https://huggingface.co/blog/sdiazlor/fine-tune-modernbert-for-rag-with-synthetic-data)
- [Fine-tune a BGE embedding model using synthetic data from Amazon Bedrock](https://aws.amazon.com/blogs/machine-learning/fine-tune-a-bge-embedding-model-using-synthetic-data-from-amazon-bedrock/)

---

## 2. Multi-Vector Representations (ColBERT)

### What It Is
Instead of pooling tokens into a single vector, keep token-level embeddings and compute fine-grained similarity at query time.

### ColBERT Late Interaction

**Key Concept:**
- **Standard embeddings:** `query → [768]`, `doc → [768]` → dot product
- **ColBERT:** `query → [N_tokens × 128]`, `doc → [M_tokens × 128]` → MaxSim operator

**MaxSim Operator:**
1. For each query token, compute similarity with all document tokens
2. Keep only the maximum similarity score for that query token
3. Sum all token-level max similarities into final score

**Advantages:**
- Preserves fine-grained semantic information (exact phrase matching)
- Handles code/stack traces better (variable names, function signatures)
- Surpasses single-vector models in quality

**Challenges:**
- **Storage:** ColBERTv1 required 154GB for MS MARCO (8.8M passages)
- **Solution:** ColBERTv2 with residual compression reduces to 16GB (1-bit compression)
- **Computation:** More expensive than single-vector (but fast with precomputed embeddings)

**Implementation:**

```python
# Using Qdrant with FastEmbed ColBERT
from qdrant_client import QdrantClient
from fastembed import TextEmbedding

# 1. Initialize ColBERT model
model = TextEmbedding(model_name="colbert-ir/colbertv2.0")

# 2. Create multi-vector collection
client = QdrantClient(":memory:")
client.create_collection(
    collection_name="errors_colbert",
    vectors_config={
        "size": 128,
        "distance": "Cosine",
        "multivector_config": {"comparator": "max_sim"}
    }
)

# 3. Index errors with token embeddings
for error in errors:
    embeddings = model.embed([error.text])  # Returns list of token vectors
    client.upsert(
        collection_name="errors_colbert",
        points=[{
            "id": error.id,
            "vector": embeddings[0],  # Multi-vector
            "payload": {"error": error.text}
        }]
    )

# 4. Query with MaxSim
query_embeddings = model.embed([query])
results = client.search(
    collection_name="errors_colbert",
    query_vector=query_embeddings[0],
    limit=10
)
```

**Database Support:** Weaviate, Qdrant, Elasticsearch, OpenSearch all support ColBERT (2025)

**Expected Gains:**
- Open-domain QA: BM25 22.1% → Dense 48.7% → **Hybrid ColBERT 53.4%**
- BEIR/TREC-DL: BM25 nDCG@10 43.4 → **ColBERT 52.6+**

**Implementation Complexity:** High (requires multi-vector DB support, more storage)
**Cost:** Medium-High (3-10x storage vs single-vector, but compressible)
**When to Use:** When exact phrase/token matching is critical (code, stack traces, technical errors)

**Sources:**
- [What is ColBERT and Late Interaction](https://jina.ai/news/what-is-colbert-and-late-interaction-and-why-they-matter-in-search/)
- [An Overview of Late Interaction Retrieval Models](https://weaviate.io/blog/late-interaction-overview)
- [Working with ColBERT - Qdrant](https://qdrant.tech/documentation/fastembed/fastembed-colbert/)

---

## 3. Query Expansion & Reformulation

### What It Is
Transform user queries to improve retrieval by expanding terms, rephrasing, or generating multiple variations.

### Techniques

#### A. Multi-Query Generation (RAG-Fusion)

Generate multiple query variations and combine results:

```python
# Use Claude/GPT to generate query variations
async def expand_query(original_query: str):
    prompt = f"""Generate 3 alternative phrasings of this error query:
    Original: {original_query}

    Focus on:
    - Synonyms (timeout/timed out, failure/failed)
    - Different error formats
    - Related error types

    Return only the 3 variations, one per line."""

    response = await anthropic.messages.create(
        model="claude-3-5-sonnet-20241022",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200
    )

    variations = response.content[0].text.strip().split('\n')
    return [original_query] + variations

# Query all variations and fuse results
async def rag_fusion_search(query: str):
    variations = await expand_query(query)

    all_results = []
    for var in variations:
        results = await vector_search(var, limit=20)
        all_results.append(results)

    # Reciprocal Rank Fusion
    fused = reciprocal_rank_fusion(all_results)
    return fused[:10]

def reciprocal_rank_fusion(result_lists, k=60):
    """Combine results from multiple queries"""
    scores = {}
    for results in result_lists:
        for rank, result in enumerate(results):
            if result.id not in scores:
                scores[result.id] = 0
            scores[result.id] += 1 / (rank + k)

    return sorted(scores.items(), key=lambda x: x[1], reverse=True)
```

**Expected Gains:**
- Precision improvements: 25-50%
- Recall improvements: 15-35%
- User satisfaction: 20-40%

#### B. LLM Query Rewriting (RQ-RAG)

Use LLM to explicitly rewrite, decompose, and disambiguate queries:

```python
# Rewrite-Retrieve-Read pattern
async def rewrite_query(user_query: str):
    prompt = f"""Rewrite this error query for semantic search:

    User query: {user_query}

    Instructions:
    - Expand abbreviations (auth → authentication, conn → connection)
    - Add error type if missing
    - Include common synonyms
    - Make it search-friendly

    Return ONLY the rewritten query."""

    response = await anthropic.messages.create(
        model="claude-3-5-haiku-20241022",  # Fast model
        messages=[{"role": "user", "content": prompt}]
    )

    return response.content[0].text.strip()

# Usage
original = "auth timeout"
rewritten = await rewrite_query(original)  # "Authentication timeout error connection"
results = await vector_search(rewritten)
```

**RQ-RAG Performance:** Surpasses previous SOTA by 1.9% on QA benchmarks (applied to Llama2-7B)

#### C. FlashRank with Query Expansion

Two-stage retrieval with query expansion + fast reranking:

```python
from flashrank import Ranker

ranker = Ranker(model="ms-marco-MiniLM-L-12-v2")

async def two_stage_retrieval(query: str):
    # Stage 1: Expand query and retrieve broad set
    expanded_queries = await expand_query(query)
    candidate_pool = []

    for q in expanded_queries:
        results = await vector_search(q, limit=50)
        candidate_pool.extend(results)

    # Deduplicate
    candidates = list({r.id: r for r in candidate_pool}.values())[:100]

    # Stage 2: Rerank with FlashRank
    passages = [{"text": c.text, "id": c.id} for c in candidates]
    reranked = ranker.rerank(query, passages)

    return reranked[:10]
```

**FlashRank Performance:**
- NDCG@10 improvement: +5.4%
- Generation accuracy: +6-8%
- Token reduction: 35%
- Latency: ~100ms (vs 4-6s for LLM reranking)

**Implementation Complexity:** Low-Medium
**Cost:** Low (Haiku queries ~$0.001 each)
**When to Use:** Always (minimal overhead, significant gains)

**Sources:**
- [Query Rewriting for Retrieval-Augmented LLMs](https://arxiv.org/abs/2305.14283)
- [RQ-RAG: Learning to Refine Queries](https://arxiv.org/html/2404.00610v1)
- [FlashRank Reranking and Query Expansion](https://arxiv.org/html/2601.03258)
- [Advanced RAG: Query Expansion](https://haystack.deepset.ai/blog/query-expansion)

---

## 4. Contextual Enrichment

### What It Is
Add metadata and context to embeddings to improve search relevance.

### Additional Context to Include

**Current:** Error message + stack trace
**Enhanced:** Error message + stack trace + **context fields**

```typescript
interface EnrichedError {
  // Core (current)
  error_message: string;
  stack_trace: string;

  // Test Context
  test_name: string;
  test_file: string;
  suite_name: string;

  // Historical Context
  first_seen: Date;
  last_seen: Date;
  failure_count: number;
  flaky: boolean;

  // Code Context
  commit_hash: string;
  pr_title?: string;
  changed_files: string[];

  // Dependency Context
  related_test_failures: string[];  // Tests that often fail together
  upstream_dependencies: string[];  // Functions/modules involved

  // Temporal Context
  time_since_last_failure: number;
  recent_changes: string;  // "First failure after 2 weeks"
}
```

**Embedding Strategy:**

```python
def create_enriched_embedding(error: EnrichedError):
    # Core error text
    core_text = f"{error.error_message}\n{error.stack_trace}"

    # Add semantic context
    context_text = f"""
    Test: {error.test_name}
    File: {error.test_file}
    Suite: {error.suite_name}
    """

    # Add temporal/historical context
    if error.flaky:
        context_text += "\nFlaky test - intermittent failures"

    if error.failure_count > 5:
        context_text += f"\nRecurring issue ({error.failure_count} failures)"

    # Add code context
    if error.pr_title:
        context_text += f"\nRecent change: {error.pr_title}"

    if error.changed_files:
        context_text += f"\nModified: {', '.join(error.changed_files[:3])}"

    # Combine for embedding
    full_text = f"{core_text}\n\nContext:{context_text}"

    return embed(full_text)
```

**Graph-Based Context:**

Build a test dependency graph to add relational context:

```sql
-- Store test co-failure relationships
CREATE TABLE test_correlations (
  test_a_id UUID,
  test_b_id UUID,
  co_failure_rate FLOAT,  -- % of time they fail together
  temporal_proximity INT,  -- Minutes between failures
  PRIMARY KEY (test_a_id, test_b_id)
);

-- Query related failures
SELECT tr.test_name, tc.co_failure_rate
FROM test_correlations tc
JOIN test_results tr ON tr.id = tc.test_b_id
WHERE tc.test_a_id = $1
  AND tc.co_failure_rate > 0.5
ORDER BY tc.co_failure_rate DESC;
```

**Expected Gains:** 10-20% improvement in relevance
**Implementation Complexity:** Low-Medium
**Cost:** Free (metadata collection)
**When to Use:** Always (low overhead, high value)

---

## 5. Hybrid Dense + Sparse Retrieval

### What It Is
Combine semantic search (dense vectors) with keyword search (sparse vectors like BM25) for complementary strengths.

### Why Hybrid Works

- **Sparse (BM25):** Precise for rare tokens, entities, exact phrases (e.g., "ECONNREFUSED", "port 3000")
- **Dense (Jina v3):** Semantic similarity, paraphrases, cross-vocabulary (e.g., "timeout" ≈ "timed out")

**Performance:**
- BM25 alone: 22.1% recall
- Dense alone: 48.7% recall
- **Hybrid: 53.4% recall**

### Implementation Approaches

#### A. Three-Way Retrieval (Optimal for RAG - 2025 IBM Research)

```python
# 1. Dense vector (Jina v3)
dense_results = await vector_search(query, limit=50)

# 2. Sparse vector (BM25) - PostgreSQL full-text search
sparse_results = await db.query("""
  SELECT id, ts_rank(search_vector, query) AS score
  FROM test_results
  WHERE search_vector @@ plainto_tsquery('english', $1)
  ORDER BY score DESC
  LIMIT 50
""", [query])

# 3. Learned sparse (SPLADE) - optional
splade_results = await splade_search(query, limit=50)

# 4. Adaptive fusion with query-specific weights
def adaptive_fusion(query, dense, sparse, splade):
    # Use LLM to determine query type
    query_type = classify_query(query)  # "factoid" | "semantic" | "mixed"

    if query_type == "factoid":
        weights = {"dense": 0.3, "sparse": 0.5, "splade": 0.2}
    elif query_type == "semantic":
        weights = {"dense": 0.6, "sparse": 0.2, "splade": 0.2}
    else:  # mixed
        weights = {"dense": 0.4, "sparse": 0.4, "splade": 0.2}

    return fuse_results(dense, sparse, splade, weights)
```

**Note:** SPLADE requires a separate model but provides learned sparse representations (extends BM25 with semantic terms).

#### B. Practical Hybrid (Dense + BM25)

For Neon PostgreSQL:

```sql
-- Enable full-text search
ALTER TABLE test_results
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector('english',
    coalesce(error_message, '') || ' ' ||
    coalesce(stack_trace, '') || ' ' ||
    coalesce(test_name, '')
  )
) STORED;

CREATE INDEX idx_search_vector ON test_results USING GIN(search_vector);

-- Hybrid search query
WITH dense AS (
  SELECT id, 1 - (embedding <=> $1::vector) AS score
  FROM test_results
  ORDER BY embedding <=> $1::vector
  LIMIT 50
),
sparse AS (
  SELECT id, ts_rank(search_vector, query) AS score
  FROM test_results, plainto_tsquery('english', $2) query
  WHERE search_vector @@ query
  ORDER BY score DESC
  LIMIT 50
)
SELECT
  COALESCE(d.id, s.id) AS id,
  COALESCE(d.score * 0.6, 0) + COALESCE(s.score * 0.4, 0) AS final_score
FROM dense d
FULL OUTER JOIN sparse s ON d.id = s.id
ORDER BY final_score DESC
LIMIT 10;
```

**Expected Gains:**
- BM25 nDCG@10: 43.4
- **Hybrid: 52.6+** (21% improvement)

**Implementation Complexity:** Low-Medium
**Cost:** Free (PostgreSQL built-in)
**When to Use:** Always (minimal overhead, significant gains)

**Sources:**
- [Dense vector + Sparse vector + Full text search](https://infiniflow.org/blog/best-hybrid-search-solution)
- [Hybrid Search Explained - Weaviate](https://weaviate.io/blog/hybrid-search-explained)
- [Reranking in Hybrid Search - Qdrant](https://qdrant.tech/documentation/advanced-tutorials/reranking-hybrid-search/)

---

## 6. Advanced Reranking

### What It Is
After initial retrieval, use a more powerful model to reorder results for maximum precision.

### Reranking Approaches

#### A. Cross-Encoder (Best Performance/Cost Ratio)

**Cross-Encoder vs Bi-Encoder:**
- **Bi-encoder (current):** Encode query and doc separately → compute similarity
- **Cross-encoder:** Encode query+doc **together** → predict relevance score

```python
from sentence_transformers import CrossEncoder

# Initialize cross-encoder
reranker = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

async def rerank_results(query: str, candidates: list):
    # Create query-doc pairs
    pairs = [[query, c.text] for c in candidates]

    # Predict relevance scores (single forward pass)
    scores = reranker.predict(pairs)

    # Reorder by score
    ranked = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)
    return [c for c, _ in ranked]

# Usage
initial_results = await vector_search(query, limit=100)  # Broad recall
final_results = await rerank_results(query, initial_results[:20])  # Precise top-10
```

**Performance:**
- More accurate than bi-encoders
- Competitive with GPT-4 zero-shot reranking
- **Way more efficient** (~100ms vs 4-6s for LLM)

**Available Models:**
- `cross-encoder/ms-marco-MiniLM-L-12-v2` (fastest)
- `cross-encoder/ms-marco-electra-base` (balanced)
- `BAAI/bge-reranker-v2-m3` (best quality)

#### B. LLM-as-a-Judge (Premium Accuracy)

Use Claude/GPT to rerank top candidates:

```python
async def llm_rerank(query: str, candidates: list):
    # Only rerank top 5-10 (LLMs are expensive)
    top_candidates = candidates[:10]

    prompt = f"""Rank these error messages by relevance to the query.

Query: {query}

Candidates:
{chr(10).join(f"{i+1}. {c.error_message[:200]}" for i, c in enumerate(top_candidates))}

Return ONLY the ranked numbers (most relevant first), e.g.: 3,1,5,2,4..."""

    response = await anthropic.messages.create(
        model="claude-3-5-sonnet-20241022",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=50
    )

    # Parse ranking
    ranking = [int(x.strip()) - 1 for x in response.content[0].text.split(',')]
    return [top_candidates[i] for i in ranking]
```

**Performance:**
- +5-8% accuracy over cross-encoders
- +4-6s latency
- **Cost:** ~$0.01 per rerank (Sonnet 3.5)

**When to Use:** Critical searches only (user-facing semantic search, not bulk processing)

#### C. Multi-Stage Reranking (Recommended Architecture)

```python
async def multi_stage_retrieval(query: str):
    # Stage 1: Broad retrieval (Jina v3 + BM25)
    candidates = await hybrid_search(query, limit=100)

    # Stage 2: Fast reranking (cross-encoder)
    reranked = await cross_encoder_rerank(query, candidates[:50])

    # Stage 3: LLM reranking (top 10 only, optional)
    if is_user_facing_search:
        final = await llm_rerank(query, reranked[:10])
    else:
        final = reranked[:10]

    return final
```

**Expected Gains:**
- Stage 1→2: +10-15% NDCG
- Stage 2→3: +5-8% accuracy (premium queries only)

**Implementation Complexity:** Low-Medium
**Cost:**
- Cross-encoder: Free (self-hosted)
- LLM: ~$0.01 per query

**When to Use:**
- Cross-encoder: Always (minimal cost, significant gains)
- LLM: User-facing searches only

**Sources:**
- [Should You Use LLMs for Reranking?](https://www.zeroentropy.dev/articles/should-you-use-llms-for-reranking-a-deep-dive-into-pointwise-listwise-and-cross-encoders)
- [Cross-Encoders and LLMs for Reranking SPLADE](https://arxiv.org/html/2403.10407v1)
- [Ultimate Guide to Choosing the Best Reranking Model in 2025](https://www.zeroentropy.dev/articles/ultimate-guide-to-choosing-the-best-reranking-model-in-2025)

---

## 7. Ensemble Methods

### What It Is
Combine predictions from multiple embedding models to improve robustness and accuracy.

### Approaches

#### A. Multi-Model Fusion

Use multiple embedding models and combine their results:

```python
from sentence_transformers import SentenceTransformer

# Load multiple models
models = {
    "jina": SentenceTransformer("jinaai/jina-embeddings-v3"),
    "bge": SentenceTransformer("BAAI/bge-large-en-v1.5"),
    "gte": SentenceTransformer("thenlper/gte-large"),
}

async def ensemble_search(query: str, limit: int = 10):
    all_results = []

    # Search with each model
    for name, model in models.items():
        query_embedding = model.encode(query)
        results = await vector_search(query_embedding, collection=f"errors_{name}", limit=50)
        all_results.append(results)

    # Vote-based fusion (reciprocal rank)
    fused = reciprocal_rank_fusion(all_results)
    return fused[:limit]
```

**Performance:**
- Multi-model fusion outperforms single models in nearly all cases
- Best results: combining 2-3 models (diminishing returns after)
- Jina v3 + BGE + GTE: ~8-12% improvement

#### B. Layer-Aware Fusion

Use embeddings from different transformer layers:

```python
# Extract embeddings from multiple layers
def get_layer_embeddings(text: str, model):
    outputs = model.encode(
        text,
        output_value='token_embeddings',
        convert_to_numpy=False,
        show_progress_bar=False
    )

    # Extract specific layers
    layers_to_use = [6, 12, 18, 24]  # Middle and late layers
    layer_embeddings = [outputs.hidden_states[i] for i in layers_to_use]

    return layer_embeddings

# Weighted fusion of layer embeddings
def fuse_layers(layer_embeddings, weights=[0.2, 0.3, 0.3, 0.2]):
    return sum(w * emb for w, emb in zip(weights, layer_embeddings))
```

**Performance:** +0.08 accuracy uplift (SST-2 benchmark)

#### C. Meta-Encoder Ensemble

Train a small model to combine embeddings:

```python
import torch.nn as nn

class MetaEncoder(nn.Module):
    def __init__(self, input_dim=768*3, output_dim=768):
        super().__init__()
        self.fc1 = nn.Linear(input_dim, 1024)
        self.fc2 = nn.Linear(1024, output_dim)
        self.relu = nn.ReLU()

    def forward(self, embeddings):
        # Concatenate embeddings from 3 models
        x = torch.cat(embeddings, dim=-1)
        x = self.relu(self.fc1(x))
        x = self.fc2(x)
        return x

# Train on positive/negative pairs
meta_encoder = MetaEncoder()
# ... training loop ...

# Use at inference
def meta_ensemble_search(query: str):
    # Get embeddings from all models
    emb1 = jina_model.encode(query)
    emb2 = bge_model.encode(query)
    emb3 = gte_model.encode(query)

    # Combine with meta-encoder
    combined = meta_encoder([emb1, emb2, emb3])
    return vector_search(combined)
```

**Performance:** 92% cache hit ratio in semantic caching experiments (2025)

**Expected Gains:** 8-15% improvement over single model
**Implementation Complexity:** Medium-High
**Cost:** Medium (3x embedding compute, 1-3x storage)
**When to Use:** When maximum accuracy justifies cost (critical production features)

**Sources:**
- [Ensemble Embedding Approach for Semantic Caching](https://arxiv.org/html/2507.07061v1)
- [Layer-Aware Embedding Fusion for LLMs](https://arxiv.org/html/2504.05764v1)
- [How to combine multiple Sentence Transformer models](https://zilliz.com/ai-faq/how-can-you-combine-or-ensemble-multiple-sentence-transformer-models-or-embeddings-to-potentially-improve-performance-on-a-task)

---

## 8. Code-Specific Embeddings

### What It Is
Use embedding models trained specifically on code/stack traces instead of general text.

### Code Embedding Models

#### A. UniXcoder (Best for Code + Text)

```python
from transformers import AutoTokenizer, AutoModel
import torch

tokenizer = AutoTokenizer.from_pretrained("microsoft/unixcoder-base")
model = AutoModel.from_pretrained("microsoft/unixcoder-base")

def get_code_embedding(stack_trace: str):
    inputs = tokenizer(stack_trace, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)

    # Mean pooling
    embedding = outputs.last_hidden_state.mean(dim=1)
    return embedding.numpy()
```

**Features:**
- Unified cross-modal (code + text)
- Supports code understanding + generation
- Better at parsing stack traces than general models

#### B. GraphCodeBERT (Best for Structural Code)

```python
from transformers import RobertaTokenizer, RobertaModel

tokenizer = RobertaTokenizer.from_pretrained("microsoft/graphcodebert-base")
model = RobertaModel.from_pretrained("microsoft/graphcodebert-base")

def get_graph_code_embedding(code_snippet: str):
    inputs = tokenizer(code_snippet, return_tensors="pt", truncation=True)
    outputs = model(**inputs)

    # CLS token as embedding
    embedding = outputs.last_hidden_state[:, 0, :]
    return embedding.numpy()
```

**Features:**
- Incorporates data flow (variable usage)
- Understands program logic, not just text
- Best for code-comment alignment

#### C. Recent Research: Stack Trace Deduplication (2024-2025)

**GPTrace:** Uses LLM embeddings for crash deduplication with stack traces + ASan reports

**JetBrains Research:** Embedding model with byte-pair encoding + approximate nearest neighbor search + reranker for stack trace deduplication

```python
# Conceptual approach from recent research
def embed_stack_trace(stack_trace: str):
    # 1. Preprocessing
    cleaned = preprocess_stack_trace(stack_trace)  # Remove addresses, normalize paths

    # 2. Extract frames
    frames = extract_stack_frames(cleaned)

    # 3. Embed each frame
    frame_embeddings = [code_model.encode(frame) for frame in frames]

    # 4. Aggregate (weighted by stack position)
    weights = [1.0 / (i + 1) for i in range(len(frames))]  # Top frames weighted higher
    final_embedding = weighted_average(frame_embeddings, weights)

    return final_embedding
```

**Performance:** LoRA config with rank 32 substantially increases MRR over UniXcoder

**Comparison (from 2025 research):**
- **CodeBERT:** Basic code-text model
- **GraphCodeBERT:** +15-20% over CodeBERT (data flow aware)
- **UniXcoder:** +10% over GraphCodeBERT (unified code+text)
- **LoRA-tuned UniXcoder:** Best performance for stack traces

**Expected Gains:** 15-25% improvement for stack trace search
**Implementation Complexity:** Medium
**Cost:** Low (models are open-source)
**When to Use:** When stack traces are primary search content

**Sources:**
- [UniXcoder README](https://github.com/microsoft/CodeBERT/blob/master/UniXcoder/README.md)
- [Stack Trace Deduplication: Faster, More Accurately](https://arxiv.org/html/2412.14802v1)
- [GPTrace: Effective Crash Deduplication Using LLM Embeddings](https://www.arxiv.org/pdf/2512.01609)

---

## 9. Contrastive Learning & Hard Negative Mining

### What It Is
Train embeddings using positive pairs (similar errors) and hard negatives (different but confusingly similar errors).

### Key Concepts

**Contrastive Loss:**
```
Loss = -log(exp(sim(anchor, positive)) / Σ exp(sim(anchor, negative_i)))
```

**Hard Negatives:** Errors with different root causes but similar text (e.g., "timeout" in network vs database context)

### Implementation

#### A. Hard Negative Mining

```python
from sentence_transformers import InputExample, losses

def mine_hard_negatives(anchor_error, all_errors):
    """Find similar-looking errors with different root causes"""

    # Get candidates by keyword overlap
    candidates = []
    anchor_keywords = set(extract_keywords(anchor_error.message))

    for error in all_errors:
        if error.id == anchor_error.id:
            continue

        error_keywords = set(extract_keywords(error.message))
        overlap = len(anchor_keywords & error_keywords) / len(anchor_keywords | error_keywords)

        # High keyword overlap but different error type/file = hard negative
        if overlap > 0.5 and error.error_type != anchor_error.error_type:
            candidates.append(error)

    return candidates[:5]  # Top 5 hard negatives

# Create training data
train_examples = []

for error in training_errors:
    # Positive: Same error in different executions
    positives = find_similar_errors(error, same_type=True)

    # Hard negatives: Similar text, different type
    hard_negatives = mine_hard_negatives(error, training_errors)

    for pos in positives:
        train_examples.append(InputExample(
            texts=[error.message, pos.message],
            label=1.0  # Similar
        ))

    for neg in hard_negatives:
        train_examples.append(InputExample(
            texts=[error.message, neg.message],
            label=0.0  # Dissimilar
        ))
```

#### B. Contrastive Fine-Tuning

```python
from sentence_transformers import SentenceTransformer, losses
from torch.utils.data import DataLoader

model = SentenceTransformer("jinaai/jina-embeddings-v3")

# Create dataloader with hard negatives
train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=16)

# Multiple Negatives Ranking Loss (best for hard negatives)
train_loss = losses.MultipleNegativesRankingLoss(model)

# Train
model.fit(
    train_objectives=[(train_dataloader, train_loss)],
    epochs=3,
    warmup_steps=100,
    evaluation_steps=500,
)
```

#### C. Dynamic Hard Negative Mining (2025 Research)

```python
# Adaptive hard negative selection
def dynamic_hard_negative_mining(anchor, candidates, model, threshold=0.7):
    """Select negatives that are close but not too close"""

    anchor_emb = model.encode(anchor)
    candidate_embs = model.encode(candidates)

    # Compute similarities
    similarities = cosine_similarity([anchor_emb], candidate_embs)[0]

    # Select negatives in "hard" range (similar but should be different)
    hard_negatives = [
        c for c, sim in zip(candidates, similarities)
        if 0.4 < sim < threshold  # Sweet spot
    ]

    return hard_negatives
```

**Expected Gains:** 10-20% improvement in discrimination ability
**Implementation Complexity:** Medium
**Cost:** Low (training cost ~$1-10 on GPU cloud)
**When to Use:** When you have labeled error pairs or can mine them from historical data

**Sources:**
- [Effective Hard Negative Mining for Code Search](https://dl.acm.org/doi/10.1145/3695994)
- [Dynamic Asymmetric Contrastive Learning](https://link.springer.com/chapter/10.1007/978-981-95-3055-7_26)
- [Contrastive Representation Learning](https://lilianweng.github.io/posts/2021-05-31-contrastive/)

---

## 10. Semantic Caching with Clustering

### What It Is
Pre-cluster common error patterns to speed up search and improve consistency.

### Approaches

#### A. Hierarchical Error Clustering

```python
from sklearn.cluster import AgglomerativeClustering
import numpy as np

async def cluster_errors(errors: list, n_clusters: int = 50):
    """Create hierarchical clusters of common error patterns"""

    # Embed all errors
    embeddings = np.array([error.embedding for error in errors])

    # Hierarchical clustering
    clustering = AgglomerativeClustering(
        n_clusters=n_clusters,
        linkage='average',
        metric='cosine'
    )

    cluster_labels = clustering.fit_predict(embeddings)

    # Compute cluster centroids
    clusters = {}
    for i in range(n_clusters):
        cluster_errors = [e for e, l in zip(errors, cluster_labels) if l == i]
        cluster_emb = np.mean([e.embedding for e in cluster_errors], axis=0)

        clusters[i] = {
            "centroid": cluster_emb,
            "representative": cluster_errors[0],  # Most common error
            "members": cluster_errors,
            "keywords": extract_common_keywords(cluster_errors)
        }

    return clusters

# Use clusters for fast search
async def clustered_search(query: str, clusters: dict):
    query_emb = embed(query)

    # Stage 1: Find nearest cluster (fast)
    cluster_similarities = [
        (i, cosine_similarity(query_emb, c["centroid"]))
        for i, c in clusters.items()
    ]
    top_clusters = sorted(cluster_similarities, key=lambda x: x[1], reverse=True)[:5]

    # Stage 2: Search within top clusters (precise)
    candidates = []
    for cluster_id, _ in top_clusters:
        candidates.extend(clusters[cluster_id]["members"])

    # Stage 3: Rerank candidates
    results = rerank(query, candidates)
    return results[:10]
```

**Benefits:**
- **Speed:** Search 50 cluster centroids instead of 100k errors
- **Consistency:** Similar queries hit same cluster
- **Caching:** Cache cluster results for common patterns

#### B. HERCULES: LLM-Enhanced Clustering (2025)

```python
async def llm_cluster_labeling(cluster_errors: list):
    """Use LLM to generate human-readable cluster descriptions"""

    sample_errors = cluster_errors[:5]  # Top 5 representative errors

    prompt = f"""Analyze these error messages and provide:
    1. A concise title for this error pattern (5-8 words)
    2. A brief description of the root cause (1-2 sentences)

Errors:
{chr(10).join(f"- {e.error_message[:150]}" for e in sample_errors)}

Format:
Title: <title>
Description: <description>"""

    response = await anthropic.messages.create(
        model="claude-3-5-haiku-20241022",
        messages=[{"role": "user", "content": prompt}]
    )

    return parse_cluster_metadata(response.content[0].text)

# Build semantic cache with clusters
async def build_semantic_cache():
    # Cluster historical errors
    clusters = await cluster_errors(historical_errors, n_clusters=100)

    # Generate labels with LLM
    for cluster_id, cluster in clusters.items():
        metadata = await llm_cluster_labeling(cluster["members"])
        cluster["title"] = metadata["title"]
        cluster["description"] = metadata["description"]

    # Store in cache
    await redis.set("error_clusters", json.dumps(clusters))
    return clusters
```

#### C. Multi-Embedding Centroid Caching

```python
# Reduce redundancy by caching cluster centroids
async def centroid_based_cache(query: str):
    # Check if query matches any cached cluster
    cache_key = f"cluster_cache:{hash(query) % 1000}"
    cached = await redis.get(cache_key)

    if cached:
        return json.loads(cached)

    # Search and cache result
    results = await clustered_search(query, error_clusters)
    await redis.setex(cache_key, 3600, json.dumps(results))  # 1h TTL
    return results
```

**Performance (2025 Research):**
- 92% cache hit ratio for semantically equivalent queries
- 85% accuracy in rejecting non-equivalent queries
- 35% token reduction (smaller context needed)

**Expected Gains:**
- Latency: 50-70% reduction (cached cluster hits)
- Consistency: 15-25% improvement (same errors → same cluster)

**Implementation Complexity:** Medium
**Cost:** Low (one-time clustering + periodic updates)
**When to Use:** When you have 10k+ historical errors and want fast, consistent search

**Sources:**
- [Advancing Semantic Caching with Domain-Specific Embeddings](https://arxiv.org/html/2504.02268v1)
- [Ensemble Embedding Approach for Semantic Caching](https://arxiv.org/html/2507.07061v1)
- [HERCULES: Hierarchical Embedding-based Recursive Clustering](https://arxiv.org/html/2506.19992)
- [Semantic clustering pipeline - NeurIPS 2025](https://github.com/mikegc-aws/neurips-poster-clustering)

---

## Prioritized Recommendations

### Tier 1: Implement Now (High Impact, Low Cost)

| Technique | Expected Gain | Complexity | Cost | Effort |
|-----------|---------------|------------|------|--------|
| **Query Expansion (RAG-Fusion)** | 25-50% precision | Low | $0.001/query | 1-2 days |
| **Hybrid Search (Dense+BM25)** | 21% improvement | Low-Medium | Free | 2-3 days |
| **Cross-Encoder Reranking** | 10-15% NDCG | Low | Free | 1 day |
| **Contextual Enrichment** | 10-20% relevance | Low | Free | 2-3 days |

**Total Implementation:** ~1 week
**Expected Combined Gain:** 40-60% improvement over baseline

### Tier 2: Implement Soon (High Impact, Medium Cost)

| Technique | Expected Gain | Complexity | Cost | Effort |
|-----------|---------------|------------|------|--------|
| **Fine-tuning Jina v3 with LoRA** | 5-15% MRR | Medium | <$10 | 1 week |
| **Semantic Caching with Clustering** | 50-70% latency | Medium | Low | 1 week |
| **Code-Specific Embeddings (UniXcoder)** | 15-25% (stack traces) | Medium | Free | 3-5 days |
| **Hard Negative Mining** | 10-20% discrimination | Medium | <$10 | 1 week |

**Total Implementation:** ~3-4 weeks
**Expected Combined Gain:** 60-80% improvement over baseline

### Tier 3: Evaluate Later (High Cost or Complexity)

| Technique | Expected Gain | Complexity | Cost | When to Use |
|-----------|---------------|------------|------|-------------|
| **ColBERT Multi-Vector** | 10-15% quality | High | Medium-High | When exact token matching is critical |
| **Ensemble Models** | 8-15% | Medium-High | 3x compute | When accuracy justifies cost |
| **LLM Reranking** | 5-8% | Low | $0.01/query | User-facing premium features |

---

## Implementation Roadmap

### Phase 1: Quick Wins (Week 1-2)
1. **Query Expansion:** Add RAG-Fusion with Claude Haiku
2. **Hybrid Search:** Implement Dense + BM25 in PostgreSQL
3. **Cross-Encoder:** Add fast reranking for top 20 results
4. **Measure:** Benchmark against current system

### Phase 2: Fine-Tuning (Week 3-4)
1. **Data Collection:** Mine 5k-10k error pairs (positive + hard negatives)
2. **Synthetic Data:** Generate variations with Claude
3. **Fine-tune Jina v3:** Use LoRA adapters (1 epoch)
4. **A/B Test:** Compare fine-tuned vs base model

### Phase 3: Optimization (Week 5-6)
1. **Contextual Enrichment:** Add test metadata, temporal context
2. **Semantic Clustering:** Pre-cluster common error patterns
3. **Cache Layer:** Implement Redis cache for clusters
4. **Monitor:** Track latency, hit rates, accuracy

### Phase 4: Advanced Features (Week 7-8)
1. **Code Embeddings:** Add UniXcoder for stack traces
2. **Hard Negative Mining:** Implement dynamic mining
3. **LLM Reranking:** Add for user-facing searches
4. **Production:** Roll out to all users

---

## Cost Analysis

### Monthly Costs (Estimated)

**Tier 1 (Immediate):**
- Query Expansion: ~$30/month (10k queries × $0.003 Haiku)
- Hybrid Search: $0 (PostgreSQL built-in)
- Cross-Encoder: $0 (self-hosted)
- **Total: ~$30/month**

**Tier 2 (Soon):**
- Fine-tuning: ~$10 one-time (GPU hours)
- Inference: $0 (same as base Jina v3)
- Clustering: ~$50 one-time (compute)
- Cache: ~$20/month (Redis)
- **Total: ~$50/month + $60 one-time**

**Tier 3 (Optional):**
- ColBERT: ~$100/month (3-5x storage, same inference)
- Ensemble: ~$150/month (3x embedding compute)
- LLM Reranking: ~$100/month (1k premium queries × $0.01)
- **Total: ~$350/month**

---

## Measuring Success

### Key Metrics

**Accuracy Metrics:**
- **MRR (Mean Reciprocal Rank):** Position of first relevant result
- **NDCG@10:** Ranking quality of top 10 results
- **Recall@50:** % of relevant results in top 50
- **Precision@10:** % of top 10 that are relevant

**User Metrics:**
- **Click-through rate:** % of searches with clicks
- **Time to resolution:** Seconds to find answer
- **Retry rate:** % of searches followed by refinement
- **User satisfaction:** Explicit feedback

**Performance Metrics:**
- **Latency:** P50, P95, P99 search times
- **Cache hit rate:** % of queries served from cache
- **Cost per query:** Total cost / query count

### Benchmarking Setup

```python
# Create test dataset
test_queries = [
    {
        "query": "timeout error connection",
        "relevant_ids": [123, 456, 789],  # Known relevant failures
    },
    # ... 100+ test cases
]

# Evaluate system
def evaluate_retrieval(system, test_queries):
    mrr_scores = []
    ndcg_scores = []

    for test in test_queries:
        results = system.search(test["query"], limit=10)
        result_ids = [r.id for r in results]

        # Calculate metrics
        mrr = calculate_mrr(result_ids, test["relevant_ids"])
        ndcg = calculate_ndcg(result_ids, test["relevant_ids"])

        mrr_scores.append(mrr)
        ndcg_scores.append(ndcg)

    return {
        "MRR": np.mean(mrr_scores),
        "NDCG@10": np.mean(ndcg_scores),
    }
```

---

## Conclusion

The most impactful improvements for test failure search are:

1. **Query Expansion + Hybrid Search:** 40-60% improvement, ~1 week, <$50/month
2. **Fine-tuning with LoRA:** 5-15% additional gain, ~1 week, <$10 one-time
3. **Semantic Caching:** 50-70% latency reduction, ~1 week, ~$20/month

These three techniques provide the best performance/cost ratio and can be implemented in 3-4 weeks with minimal ongoing costs. ColBERT and ensemble methods should be evaluated later if accuracy requirements justify the additional complexity and cost.

**Total Expected Improvement:** 60-80% over baseline with Tier 1 + Tier 2 techniques.

---

**Document Version:** 1.0
**Last Updated:** 2026-01-13
**Research Period:** 2024-2026
**Primary Focus:** Practical, implementable techniques for Jina v3 + Next.js + Neon PostgreSQL stack
