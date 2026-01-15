# Error Embedding Optimization Analysis

Use Claude Code to analyze test failures and discover optimal chunking/sanitization patterns.

---

## Step 1: Extract Diverse Errors

Run these queries against your Neon database to get a representative sample.

### Query A: Diverse by Error Type (Recommended)

```sql
-- Get 50 diverse errors, sampling across different error patterns
WITH categorized AS (
  SELECT
    id,
    test_name,
    test_file,
    error_message,
    LEFT(stack_trace, 3000) as stack_trace,
    CASE
      WHEN error_message ~* 'timeout' THEN 'timeout'
      WHEN error_message ~* 'expect\(.*\)\.to' THEN 'assertion'
      WHEN error_message ~* 'selector|locator|element' THEN 'selector'
      WHEN error_message ~* 'ECONNREFUSED|ENOTFOUND|network' THEN 'network'
      WHEN error_message ~* 'unauthorized|forbidden|401|403' THEN 'auth'
      WHEN error_message ~* 'null|undefined' THEN 'nullref'
      ELSE 'other'
    END as error_category,
    ROW_NUMBER() OVER (
      PARTITION BY CASE
        WHEN error_message ~* 'timeout' THEN 'timeout'
        WHEN error_message ~* 'expect\(.*\)\.to' THEN 'assertion'
        WHEN error_message ~* 'selector|locator|element' THEN 'selector'
        WHEN error_message ~* 'ECONNREFUSED|ENOTFOUND|network' THEN 'network'
        WHEN error_message ~* 'unauthorized|forbidden|401|403' THEN 'auth'
        WHEN error_message ~* 'null|undefined' THEN 'nullref'
        ELSE 'other'
      END
      ORDER BY RANDOM()
    ) as rn
  FROM test_results
  WHERE status = 'failed'
    AND error_message IS NOT NULL
    AND LENGTH(error_message) > 20
)
SELECT
  id,
  error_category,
  test_name,
  test_file,
  error_message,
  stack_trace
FROM categorized
WHERE rn <= 8  -- ~8 per category = ~50 total
ORDER BY error_category, rn;
```

### Query B: Unique Error Signatures

```sql
-- Get errors with unique first 100 chars (deduplicate similar errors)
SELECT DISTINCT ON (LEFT(error_message, 100))
  id,
  test_name,
  test_file,
  error_message,
  LEFT(stack_trace, 3000) as stack_trace,
  created_at
FROM test_results
WHERE status = 'failed'
  AND error_message IS NOT NULL
  AND LENGTH(error_message) > 20
ORDER BY LEFT(error_message, 100), created_at DESC
LIMIT 50;
```

### Query C: Recent + High Frequency

```sql
-- Mix of recent errors and frequently occurring ones
(
  -- 25 most recent unique errors
  SELECT DISTINCT ON (LEFT(error_message, 80))
    id, test_name, test_file, error_message,
    LEFT(stack_trace, 3000) as stack_trace,
    'recent' as source
  FROM test_results
  WHERE status = 'failed' AND error_message IS NOT NULL
  ORDER BY LEFT(error_message, 80), created_at DESC
  LIMIT 25
)
UNION ALL
(
  -- 25 most frequent error patterns
  SELECT
    MIN(id) as id,
    MIN(test_name) as test_name,
    MIN(test_file) as test_file,
    LEFT(error_message, 500) as error_message,
    MIN(LEFT(stack_trace, 3000)) as stack_trace,
    'frequent' as source
  FROM test_results
  WHERE status = 'failed' AND error_message IS NOT NULL
  GROUP BY LEFT(error_message, 100)
  ORDER BY COUNT(*) DESC
  LIMIT 25
);
```

---

## Step 2: Export to JSON

After running the query, export results:

```bash
# If using psql
psql $DATABASE_URL -c "COPY (YOUR_QUERY_HERE) TO STDOUT WITH CSV HEADER" > errors.csv

# Or use Neon console to export as JSON
```

---

## Step 3: Analysis Prompt Template

Copy this prompt and paste your errors at the end:

```xml
<context>
You are analyzing test failures from a Playwright E2E test suite to optimize how we prepare error content for vector embeddings. The goal is to maximize semantic search quality - users will search with natural language queries like "timeout errors in login", "flaky checkout tests", "API connection failures".

Current embedding model: Jina v3 (512 dimensions, asymmetric retrieval)
Current approach: Rule-based regex sanitization
Goal: Discover patterns to improve chunking and semantic enrichment
</context>

<task>
Analyze the 50 test failures below and produce:

1. **SIGNAL vs NOISE Analysis**
   For each error category, identify:
   - ESSENTIAL: Information critical for semantic matching
   - USEFUL: Context that helps but isn't required
   - NOISE: Data that hurts embedding quality (should remove)
   - NORMALIZE: Variations that should map to same concept

2. **Chunking Strategy**
   Recommend the optimal structure for embedding text:
   - What sections to include and in what order
   - Optimal length for each section
   - How to handle long stack traces
   - Whether to embed multiple chunks per error

3. **Regex Patterns**
   Provide production-ready regex patterns for:
   - Extracting error type/category
   - Removing noise (timestamps, UUIDs, memory addresses, etc.)
   - Normalizing file paths
   - Extracting key code patterns

4. **Semantic Enrichment**
   For each error category, suggest:
   - Category name and description
   - Synonyms for better query matching
   - Related terms users might search for

5. **Edge Cases**
   Document any unusual patterns that need special handling
</task>

<output_format>
Structure your response as:

## 1. Signal vs Noise Analysis

### Category: [name]
- **ESSENTIAL**: [what to keep]
- **USEFUL**: [optional context]
- **NOISE**: [what to remove]
- **NORMALIZE**: [variations → standard form]

## 2. Recommended Chunking Strategy

```
[Template showing optimal embedding text structure]
```

## 3. Regex Patterns

```typescript
// Pattern name and purpose
const PATTERN_NAME = /regex/flags;
// Example input → output
```

## 4. Semantic Enrichment Map

```typescript
const ERROR_CATEGORIES = {
  "CategoryName": {
    description: "...",
    synonyms: ["...", "..."],
    relatedTerms: ["...", "..."]
  }
}
```

## 5. Edge Cases & Recommendations

- [edge case]: [how to handle]
</output_format>

<errors>
PASTE YOUR 50 ERRORS HERE IN JSON FORMAT:

[
  {
    "id": 123,
    "error_category": "timeout",
    "test_name": "should login successfully",
    "test_file": "tests/auth/login.spec.ts",
    "error_message": "TimeoutError: locator.click: Timeout 30000ms exceeded...",
    "stack_trace": "at Object.click (/node_modules/playwright/lib/...)..."
  },
  ...
]
</errors>
```

---

## Step 4: Refinement Prompt (Week 2+)

After implementing v1 rules, find poorly-performing searches:

```sql
-- Find errors that users searched for but didn't find good matches
-- (Requires search logging - implement if not exists)
SELECT
  query,
  COUNT(*) as search_count,
  AVG(top_result_similarity) as avg_similarity
FROM search_logs
WHERE top_result_similarity < 0.7  -- Poor matches
GROUP BY query
ORDER BY search_count DESC
LIMIT 20;
```

Then use this refinement prompt:

```xml
<context>
We implemented v1 sanitization rules based on your previous analysis.
Here are 20 search queries that returned poor results (low similarity scores).
Help us identify what patterns we're missing.
</context>

<current_rules>
[Paste current sanitizer.ts patterns]
</current_rules>

<poor_searches>
[Paste queries with low similarity]
</poor_searches>

<related_errors>
[Paste the actual errors that SHOULD have matched these queries]
</related_errors>

<task>
1. Why did these searches fail to match?
2. What patterns are we missing in our sanitization?
3. What synonyms should we add?
4. Suggest specific code changes to fix each case.
</task>
```

---

## Step 5: Apply Findings

After Claude's analysis, update these files:

1. **[lib/ai/sanitizer.ts](lib/ai/sanitizer.ts)** - Add new regex patterns and categories
2. **[lib/ai/sanitizer.ts](lib/ai/sanitizer.ts)** - Update `ERROR_CATEGORIES` with new synonyms
3. **Re-embed affected tests**:
   ```bash
   # Via MCP
   perform_exolar_action({ action: "reembed", params: { type: "error", force: true } })
   ```

---

## Iteration Schedule

| Week | Action | Errors Analyzed |
|------|--------|-----------------|
| 1 | Initial analysis | 50 diverse errors |
| 2 | Refinement based on poor searches | 20 problem cases |
| 3 | Edge case handling | 10-15 outliers |
| 4+ | Maintenance (monthly) | New error patterns |

---

## Notes

- Cache Claude's analysis responses - patterns don't change often
- Track embedding quality metrics before/after each iteration
- Consider A/B testing: v1 rules vs v2 rules on same error set
