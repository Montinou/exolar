# Error Embedding Optimization Analysis

> Analysis of test failures to optimize embedding preparation for semantic search

**Date**: 2026-01-13
**Sample Size**: 20 test failures
**Source**: [errors-sample.json](../../research/errors-sample.json)
**Embedding Model**: Jina v3 (512 dimensions, asymmetric retrieval)

---

## Executive Summary

This analysis identifies patterns in Playwright E2E test failures to maximize semantic search quality. Users search with natural language queries like "timeout errors in login", "flaky checkout tests", "API connection failures" - our embedding strategy must optimize for these query patterns.

### Key Findings

| Finding | Impact | Action |
|---------|--------|--------|
| 30% of samples are duplicates | High | Implement deduplication before embedding |
| ANSI codes in 100% of assertion errors | High | Strip before any processing |
| UUIDs create false semantic matches | Medium | Replace with `[UUID]` placeholder |
| Category "other" is too generic | Medium | Sub-categorize into api_error, retry_exhausted |
| Long runner paths add noise | Low | Normalize to relative paths |

---

## 1. Signal vs Noise Analysis

### Category: nullref (8 samples, 40%)

Assertion failures where expected value doesn't match received value.

| Signal Type | Content | Example |
|-------------|---------|---------|
| **ESSENTIAL** | Assertion type | `toBe`, `toBeTruthy` |
| **ESSENTIAL** | Expected value | `"public"` |
| **ESSENTIAL** | Received value | `undefined`, `null` |
| **ESSENTIAL** | Test name | "Network Exhaustion: should exhaust all 3 attorneys..." |
| **ESSENTIAL** | Test file path | `my-referral-network/phase2/network-assignment-and-rejection.spec.ts` |
| **USEFUL** | Line number | `:192` |
| **USEFUL** | Test context | phase2, negotiation |
| **NOISE** | ANSI escape codes | `\u001b[2m`, `\u001b[31m` |
| **NOISE** | Full runner path | `/home/runner/work/attorney_share_mvp_web/...` |
| **NOISE** | Duplicated error in stack | Same message repeated |

**Normalization Rules:**
- `undefined` / `null` → "nullish value"
- `toBe` / `toEqual` / `toStrictEqual` → "equality assertion"
- `toBeTruthy` / `toBeDefined` / `toBeNull` → "existence assertion"

---

### Category: timeout (8 samples, 40%)

Operations that exceeded time limits waiting for elements.

| Signal Type | Content | Example |
|-------------|---------|---------|
| **ESSENTIAL** | Element selector | `network-settings-card-button` |
| **ESSENTIAL** | Action attempted | `click`, `waitFor` |
| **ESSENTIAL** | Timeout value | `15000ms` |
| **ESSENTIAL** | Page Object/helper | `PO_CaseV2.waitForProposalModalToClose` |
| **USEFUL** | Resolution attempts | "35 × locator resolved to visible" |
| **USEFUL** | Element visibility state | "visible", "hidden" |
| **NOISE** | ANSI escape codes | `\u001b[2m` |
| **NOISE** | Full runner paths | `/home/runner/work/...` |
| **NOISE** | CSS class names | `css-7xusza`, `MuiDialog-root` |
| **NOISE** | "Call log:" header | Static text |

**Normalization Rules:**
- Various timeout values → "timeout exceeded"
- `locator.click` / `locator.waitFor` → "locator action"
- `getByTestId` / `[data-testid=` → "testid selector"

---

### Category: other (4 samples, 20%)

Mixed errors that need sub-categorization.

| Signal Type | Content | Example |
|-------------|---------|---------|
| **ESSENTIAL** | Error type | "Proposal failed", "Status verification failed" |
| **ESSENTIAL** | Status code | `500` |
| **ESSENTIAL** | Utility function | `sendProposal`, `stepVerifyCaseStatus` |
| **USEFUL** | Retry attempts | "after 5 attempts" |
| **USEFUL** | Entity type | Case, Proposal |
| **NOISE** | UUIDs | `2fd0dbe5-7a2c-40de-b0d9-7f2a13444463` |
| **NOISE** | Full runner paths | `/home/runner/work/...` |

**Sub-categories identified:**
- `api_error`: HTTP 5xx responses from backend
- `retry_exhausted`: Operations failed after max retries

**Normalization Rules:**
- "status 500" / "status 502" / "status 503" → "server error (5xx)"
- "not found after X attempts" → "retry exhausted"

---

## 2. Recommended Chunking Strategy

### Optimal Embedding Template

```
[ERROR_TYPE]: [NORMALIZED_CATEGORY]
Test: [TEST_NAME]
File: [RELATIVE_TEST_FILE]
Action: [WHAT_WAS_ATTEMPTED]
Expected: [EXPECTED_VALUE_OR_STATE]
Actual: [ACTUAL_VALUE_OR_STATE]
Location: [FUNCTION_OR_PAGE_OBJECT]:[LINE_NUMBER]
```

### Guidelines

| Aspect | Recommendation | Rationale |
|--------|----------------|-----------|
| **Target length** | 150-300 tokens | Optimal for Jina v3 dense retrieval |
| **Chunks per error** | Single chunk | Unless multiple distinct failure points |
| **Stack trace** | First user-code frame only | Framework internals add noise |
| **Content order** | Error type → Test name → Details | Most searchable content first |
| **Deduplication key** | `test_name + error_type + location` | Prevents embedding duplicates |

### Example Outputs

**nullref category:**
```
ERROR_TYPE: Assertion Failure - Null Reference
Test: Network Exhaustion: should exhaust all 3 attorneys and fallback to marketplace
File: my-referral-network/phase2/network-assignment-and-rejection.spec.ts
Action: Equality check with toBe
Expected: "public"
Actual: undefined
Location: network-assignment-and-rejection.spec.ts:192
```

**timeout category:**
```
ERROR_TYPE: Timeout - Element Not Interactive
Test: Modal opens and displays all sections
File: my-referral-network/e2e/network-settings.spec.ts
Action: Click on element
Selector: network-settings-card-button
Timeout: 15000ms
Location: network-settings.spec.ts:175
```

**api_error category:**
```
ERROR_TYPE: API Error - Server Failure
Test: Create signed case for Case Manager (Kaoru)
File: negotiation/multi-role-signed-cases.spec.ts
Action: Send proposal via API
Status: 500 Internal Server Error
Location: api-signed-case-helper.ts:269 (sendProposal)
```

---

## 3. Regex Patterns

### Core Sanitization

```typescript
/**
 * Remove ANSI escape codes from error messages
 * Must run BEFORE any value extraction
 */
const ANSI_CODES = /\u001b\[[0-9;]*m/g;
// Input:  "\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m"
// Output: "expect(received"

/**
 * Normalize GitHub Actions runner paths to relative
 * Handles both /tests/ and direct automation/playwright/ paths
 */
const RUNNER_PATH = /\/home\/runner\/work\/[^\/]+\/[^\/]+\/automation\/playwright\/(tests\/)?/g;
// Input:  "/home/runner/work/attorney_share_mvp_web/attorney_share_mvp_web/automation/playwright/tests/negotiation/file.ts"
// Output: "negotiation/file.ts"

/**
 * Replace UUIDs with placeholder to prevent false matches
 */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// Input:  "Case 2fd0dbe5-7a2c-40de-b0d9-7f2a13444463 not found"
// Output: "Case [UUID] not found"

/**
 * Remove CSS class names from element descriptions
 */
const CSS_CLASSES = /\s+class="[^"]*"/g;
// Input:  '<div class="MuiDialog-root MuiModal-root css-7xusza">'
// Output: '<div>'

/**
 * Remove repetition count from Playwright call logs
 */
const REPETITION_COUNT = /\d+\s*×\s*/g;
// Input:  "35 × locator resolved to visible"
// Output: "locator resolved to visible"
```

### Value Extraction

```typescript
/**
 * Extract timeout value in milliseconds
 */
const TIMEOUT_VALUE = /Timeout (\d+)ms exceeded/;
// Input:  "Timeout 15000ms exceeded"
// Output: captures["15000"]

/**
 * Extract selector/testid from locator expressions
 * Handles both getByTestId() and data-testid attribute selectors
 */
const TESTID_SELECTOR = /(?:getByTestId\(['"]|data-testid[=^]?["'])([^'"]+)/g;
// Input:  "getByTestId('network-settings-card-button')"
// Output: captures "network-settings-card-button"
// Input:  "[data-testid=\"case-send-proposal-modal\"]"
// Output: captures "case-send-proposal-modal"

/**
 * Extract HTTP status code from error messages
 */
const HTTP_STATUS = /(?:status|Status)\s*(\d{3})/;
// Input:  "Proposal failed with status 500"
// Output: captures "500"

/**
 * Extract assertion type from Playwright/Jest matchers
 */
const ASSERTION_TYPE = /expect\([^)]+\)\.(to\w+)/;
// Input:  "expect(received).toBeTruthy()"
// Output: captures "toBeTruthy"

/**
 * Extract expected value from assertion output
 * Handles ANSI codes and quotes
 */
const EXPECTED_VALUE = /Expected:\s*(?:\u001b\[\d+m)*["']?([^"'\n\u001b]+)/;
// Input:  'Expected: \u001b[32m"public"\u001b[39m'
// Output: captures "public"

/**
 * Extract received value from assertion output
 */
const RECEIVED_VALUE = /Received:\s*(?:\u001b\[\d+m)*["']?([^"'\n\u001b]+)/;
// Input:  'Received: \u001b[31mundefined\u001b[39m'
// Output: captures "undefined"

/**
 * Extract file and line number from stack trace
 * Captures first user-code frame (not node_modules)
 */
const STACK_FRAME = /at\s+(?:\w+\s+)?\(?([\w\-\/\.]+\.(?:ts|js)):(\d+)(?::\d+)?\)?/;
// Input:  "at network-assignment-and-rejection.spec.ts:192:44"
// Output: captures ["network-assignment-and-rejection.spec.ts", "192"]
```

### Combined Sanitization Function

```typescript
export function sanitizeForEmbedding(errorMessage: string, stackTrace: string): string {
  // 1. Remove ANSI codes first (affects all subsequent parsing)
  let cleaned = errorMessage.replace(ANSI_CODES, '');
  let cleanedStack = stackTrace.replace(ANSI_CODES, '');

  // 2. Normalize paths
  cleaned = cleaned.replace(RUNNER_PATH, '');
  cleanedStack = cleanedStack.replace(RUNNER_PATH, '');

  // 3. Replace UUIDs
  cleaned = cleaned.replace(UUID, '[UUID]');

  // 4. Remove CSS classes
  cleaned = cleaned.replace(CSS_CLASSES, '');

  // 5. Remove repetition counts
  cleaned = cleaned.replace(REPETITION_COUNT, '');

  // 6. Extract first user-code stack frame
  const frameMatch = cleanedStack.match(STACK_FRAME);
  const location = frameMatch ? `${frameMatch[1]}:${frameMatch[2]}` : 'unknown';

  return { cleaned, location };
}
```

---

## 4. Semantic Enrichment Map

```typescript
export const ERROR_CATEGORIES = {
  nullref: {
    description: "Assertion failed because a value was null, undefined, or did not match expected",
    synonyms: [
      "null reference",
      "undefined error",
      "assertion failure",
      "null pointer",
      "missing value",
      "value mismatch"
    ],
    relatedTerms: [
      "toBe",
      "toBeTruthy",
      "toBeNull",
      "toEqual",
      "undefined",
      "null",
      "expected",
      "received",
      "match",
      "assertion"
    ],
    searchPatterns: [
      "null errors",
      "undefined failures",
      "assertion failures",
      "value not matching",
      "expected vs received"
    ]
  },

  timeout: {
    description: "Operation exceeded time limit waiting for element or condition",
    synonyms: [
      "timeout error",
      "element not found",
      "wait exceeded",
      "locator timeout",
      "click timeout",
      "element not visible",
      "element not interactive"
    ],
    relatedTerms: [
      "waitFor",
      "click",
      "locator",
      "selector",
      "visible",
      "hidden",
      "modal",
      "button",
      "15000ms",
      "30000ms",
      "exceeded"
    ],
    searchPatterns: [
      "timeout errors",
      "element not found",
      "click failures",
      "waiting too long",
      "modal stuck"
    ]
  },

  api_error: {
    description: "Backend API returned an error status code (4xx or 5xx)",
    synonyms: [
      "server error",
      "API failure",
      "HTTP error",
      "500 error",
      "backend failure",
      "request failed",
      "endpoint error"
    ],
    relatedTerms: [
      "status",
      "500",
      "502",
      "503",
      "504",
      "proposal",
      "request",
      "response",
      "endpoint",
      "API"
    ],
    searchPatterns: [
      "API errors",
      "server failures",
      "500 errors",
      "backend issues",
      "HTTP failures"
    ]
  },

  retry_exhausted: {
    description: "Operation failed after multiple retry attempts",
    synonyms: [
      "retry failure",
      "max retries exceeded",
      "attempts exhausted",
      "not found after retries",
      "verification failed",
      "polling timeout"
    ],
    relatedTerms: [
      "attempts",
      "retry",
      "found",
      "status",
      "verification",
      "case",
      "polling",
      "exhausted"
    ],
    searchPatterns: [
      "retry failures",
      "max attempts",
      "not found errors",
      "verification failures"
    ]
  },

  modal_stuck: {
    description: "Modal dialog did not close or transition as expected",
    synonyms: [
      "modal timeout",
      "dialog stuck",
      "popup not closing",
      "modal visible",
      "dialog not hidden",
      "overlay stuck"
    ],
    relatedTerms: [
      "modal",
      "dialog",
      "close",
      "hidden",
      "visible",
      "proposal-modal",
      "MuiDialog",
      "popup",
      "overlay"
    ],
    searchPatterns: [
      "modal stuck",
      "dialog not closing",
      "popup issues",
      "modal timeout"
    ]
  }
} as const;

export type ErrorCategory = keyof typeof ERROR_CATEGORIES;
```

### Category Detection Function

```typescript
export function detectErrorCategory(
  errorMessage: string,
  currentCategory: string
): ErrorCategory {
  const msg = errorMessage.toLowerCase();

  // Sub-categorize "other" category
  if (currentCategory === 'other') {
    if (/status\s*5\d{2}|failed with status/.test(msg)) {
      return 'api_error';
    }
    if (/after\s*\d+\s*attempts|not found after/.test(msg)) {
      return 'retry_exhausted';
    }
  }

  // Detect modal-specific timeout
  if (currentCategory === 'timeout') {
    if (/modal|dialog|popup|overlay/.test(msg)) {
      return 'modal_stuck';
    }
  }

  // Keep original category if no sub-category detected
  return currentCategory as ErrorCategory;
}
```

---

## 5. Edge Cases & Recommendations

### Critical Edge Cases

| Edge Case | Occurrence | Solution |
|-----------|------------|----------|
| **Duplicate errors** | 6/20 samples (30%) | Deduplicate using `test_name + normalized_error + file` as key before embedding |
| **ANSI codes inside values** | 100% of assertion errors | Run `ANSI_CODES.replace()` BEFORE extracting Expected/Received values |
| **Nested quotes in selectors** | Some testid selectors | Use positive lookbehind: `/(?<=testid[=^]['"])[^'"]+/` |
| **Multiple stack frames** | All errors | Extract only first frame from user code (skip `node_modules`, Playwright internals) |

### Moderate Edge Cases

| Edge Case | Occurrence | Solution |
|-----------|------------|----------|
| **Very long test names** | ~40% | Truncate after first colon for embedding, keep full for display |
| **Line numbers change frequently** | Git changes | Consider embedding without line number for more stable similarity matching |
| **Category "other" too generic** | 20% of samples | Apply `detectErrorCategory()` to sub-categorize |
| **Flaky indicator in timeout** | "35 × locator resolved to visible" | High repetition count with visible element suggests race condition - tag as potential flaky |

### Implementation Recommendations

```typescript
// Deduplication before embedding
function generateDedupKey(error: TestError): string {
  const normalizedError = sanitizeForEmbedding(error.error_message, '').cleaned;
  const errorType = detectErrorCategory(error.error_message, error.error_category);
  return `${error.test_name}::${errorType}::${error.test_file}::${normalizedError.substring(0, 100)}`;
}

// Flaky detection from timeout errors
function detectPotentialFlaky(errorMessage: string): boolean {
  const repetitionMatch = errorMessage.match(/(\d+)\s*×\s*locator resolved/);
  if (repetitionMatch) {
    const count = parseInt(repetitionMatch[1], 10);
    // High repetition with visible element suggests race condition
    return count > 10 && /visible/.test(errorMessage);
  }
  return false;
}

// Line number stability option
interface EmbeddingOptions {
  includeLineNumbers: boolean;  // Set false for more stable similarity
  maxTestNameLength: number;    // Truncate long names
  includeSynonyms: boolean;     // Add category synonyms to embedding
}
```

---

## 6. Implementation Priority

### Phase 1: High Impact (Immediate)

1. **ANSI code removal** - Affects 100% of assertion errors
2. **Path normalization** - Reduces noise in all stack traces
3. **Deduplication** - 30% of samples are duplicates

### Phase 2: Medium Impact (Short-term)

4. **Semantic enrichment** - Add category synonyms to embedding text
5. **UUID replacement** - Prevents false semantic matches
6. **Category sub-classification** - Split "other" into api_error, retry_exhausted

### Phase 3: Optimization (Long-term)

7. **Flaky detection** - Tag potential flaky tests based on timeout patterns
8. **Line number toggle** - Option for more stable similarity matching
9. **Multi-chunk strategy** - For errors with multiple distinct failure points

---

## Appendix: Sample Distribution

| Category | Count | Percentage | Unique Errors |
|----------|-------|------------|---------------|
| nullref | 8 | 40% | 2 unique |
| timeout | 8 | 40% | 4 unique |
| other | 4 | 20% | 4 unique |
| **Total** | 20 | 100% | **10 unique** |

**Deduplication Impact**: Embedding 10 unique errors vs 20 total = 50% reduction in embedding costs.
