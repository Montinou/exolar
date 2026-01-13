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
  sanitized = sanitized.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "[DATE]")
  sanitized = sanitized.replace(/\b\d{4}-\d{2}-\d{2}\b/g, "[DATE]")

  // Time formats
  sanitized = sanitized.replace(
    /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/g,
    "[TIME]"
  )

  // Session/token IDs (long alphanumeric strings)
  sanitized = sanitized.replace(/\b[A-Za-z0-9_-]{20,}\b/g, "[TOKEN]")

  // IP addresses
  sanitized = sanitized.replace(
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    "[IP]"
  )

  // Port numbers after hosts
  sanitized = sanitized.replace(/:(\d{4,5})\b/g, ":[PORT]")

  // File paths with dynamic segments (keep structure)
  // /tmp/playwright-123456/
  sanitized = sanitized.replace(/\/tmp\/[^/\s]+\//g, "/tmp/[TEMP]/")

  // Memory addresses
  sanitized = sanitized.replace(/0x[0-9a-f]+/gi, "[ADDR]")

  // Line numbers in stack traces (normalize but keep structure)
  // Keep line numbers as they're useful for grouping
  // But normalize column numbers which vary more
  sanitized = sanitized.replace(/:(\d+):(\d+)\)/g, ":$1:[COL])")

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
  sanitized = sanitized.replace(/\/(?:Users|home)\/[^/]+\/[^/]+\//g, "")

  // Windows paths
  sanitized = sanitized.replace(/[A-Z]:\\Users\\[^\\]+\\[^\\]+\\/gi, "")

  // Node modules paths - keep package name but normalize path
  sanitized = sanitized.replace(/node_modules\/([^/]+)\//g, "node_modules/$1/")

  // Remove async context IDs
  sanitized = sanitized.replace(/async.*<anonymous>/g, "async [ANONYMOUS]")

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

// ============================================
// Universal Test Embedding Functions
// ============================================

/**
 * Test result data for embedding preparation
 */
export interface TestResultForEmbedding {
  test_name: string
  test_file: string | null
  status: string
  duration_ms?: number | null
  browser?: string | null
  retry_count?: number | null
  error_message?: string | null
}

/**
 * Extract semantic keywords from test name
 *
 * Tokenizes camelCase, snake_case, kebab-case and extracts meaningful words
 */
function extractKeywords(text: string): string[] {
  // Split on common separators and case boundaries
  const words = text
    // Split camelCase: "shouldLoginSuccessfully" -> "should Login Successfully"
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // Split snake_case and kebab-case
    .replace(/[_-]/g, " ")
    // Remove common test prefixes
    .replace(/^(should|it|test|spec|describe)\s+/gi, "")
    // Split on spaces and filter
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2) // Skip tiny words

  // Remove common stop words
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "are",
    "was",
    "were",
    "been",
    "have",
    "has",
    "had",
    "can",
    "will",
    "when",
    "then",
    "than",
    "into",
  ])

  return words.filter((w) => !stopWords.has(w))
}

/**
 * Extract feature area from file path
 *
 * Identifies the domain/feature from test file structure
 */
function extractFeatureArea(filePath: string): string | null {
  if (!filePath) return null

  // Normalize path
  const normalized = filePath.replace(/\\/g, "/").toLowerCase()

  // Common patterns to extract feature area
  // e.g., "tests/auth/login.spec.ts" -> "auth"
  // e.g., "e2e/cases/marketplace/filters.spec.ts" -> "marketplace"

  const patterns = [
    /(?:tests?|specs?|e2e|playwright)\/(?:cases\/)?([^/]+)/,
    /\/([^/]+)\/[^/]+\.(?:spec|test)\.[tj]sx?$/,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match && match[1]) {
      // Clean up the feature name
      return match[1].replace(/[_-]/g, " ").trim()
    }
  }

  return null
}

/**
 * Get semantic synonyms for common test concepts
 */
function getSemanticSynonyms(keywords: string[]): string[] {
  const synonymMap: Record<string, string[]> = {
    login: ["authentication", "signin", "sign-in", "auth"],
    logout: ["signout", "sign-out", "deauthentication"],
    auth: ["authentication", "authorization", "login"],
    signup: ["registration", "register", "sign-up", "create account"],
    filter: ["search", "query", "find", "select"],
    search: ["filter", "find", "query", "lookup"],
    create: ["add", "new", "insert"],
    delete: ["remove", "destroy", "erase"],
    update: ["edit", "modify", "change"],
    list: ["view", "display", "show", "table"],
    modal: ["dialog", "popup", "overlay"],
    button: ["click", "action", "submit"],
    form: ["input", "submit", "validation"],
    error: ["failure", "exception", "bug"],
    timeout: ["slow", "delay", "wait"],
    user: ["account", "profile", "member"],
    admin: ["administrator", "superuser", "management"],
    notification: ["alert", "message", "toast"],
    dashboard: ["home", "overview", "main"],
    settings: ["preferences", "configuration", "options"],
    payment: ["checkout", "billing", "purchase"],
    cart: ["basket", "shopping"],
    order: ["purchase", "transaction"],
    navigation: ["menu", "routing", "navigate"],
  }

  const synonyms: Set<string> = new Set()
  for (const keyword of keywords) {
    const relatedWords = synonymMap[keyword]
    if (relatedWords) {
      relatedWords.forEach((s) => synonyms.add(s))
    }
  }

  return Array.from(synonyms)
}

/**
 * Prepare any test result (passed, failed, skipped) for embedding
 *
 * Creates a semantic text representation that captures the test's identity
 * and context without dynamic tokens. Enhanced with keywords and synonyms
 * for better semantic matching.
 *
 * @param test - Test result data
 * @returns Text ready for embedding
 *
 * @example
 * prepareTestForEmbedding({
 *   test_name: "should login successfully",
 *   test_file: "tests/auth/login.spec.ts",
 *   status: "passed",
 *   duration_ms: 1500,
 *   browser: "chromium"
 * })
 * // Returns enhanced text with keywords and synonyms
 */
export function prepareTestForEmbedding(test: TestResultForEmbedding): string {
  const parts: string[] = []

  // Test identity (full name for exact matching)
  parts.push(`Test: ${test.test_name}`)

  // File path (normalized)
  let featureArea: string | null = null
  if (test.test_file) {
    // Remove absolute path prefixes, keep relative structure
    const normalizedFile = test.test_file
      .replace(/^.*?(?:tests?\/|specs?\/|e2e\/|playwright\/)/i, "")
      .replace(/\\/g, "/")
    parts.push(`File: ${normalizedFile || test.test_file}`)

    // Extract feature area
    featureArea = extractFeatureArea(test.test_file)
    if (featureArea) {
      parts.push(`Feature: ${featureArea}`)
    }
  }

  // Extract keywords from test name for semantic matching
  const keywords = extractKeywords(test.test_name)
  if (keywords.length > 0) {
    parts.push(`Keywords: ${keywords.join(", ")}`)
  }

  // Add semantic synonyms for better matching
  const synonyms = getSemanticSynonyms(keywords)
  if (synonyms.length > 0) {
    // Limit synonyms to avoid noise
    parts.push(`Related: ${synonyms.slice(0, 5).join(", ")}`)
  }

  // Status with context
  parts.push(`Status: ${test.status}`)

  // Duration (human-readable)
  if (test.duration_ms != null && test.duration_ms > 0) {
    const seconds = (test.duration_ms / 1000).toFixed(1)
    parts.push(`Duration: ${seconds}s`)
  }

  // Browser context
  if (test.browser) {
    parts.push(`Browser: ${test.browser}`)
  }

  // Retry information (useful for flakiness context)
  if (test.retry_count != null && test.retry_count > 0) {
    parts.push(`Retries: ${test.retry_count}`)
  }

  // For failed tests, include sanitized error (brief)
  if (test.status === "failed" && test.error_message) {
    const sanitizedError = sanitizeErrorMessage(test.error_message)
    // Truncate to first line or 200 chars for embedding focus
    const briefError = sanitizedError.split("\n")[0].slice(0, 200)
    parts.push(`Error: ${briefError}`)
  }

  return parts.join("\n")
}

/**
 * Execution data for suite embedding preparation
 */
export interface ExecutionForEmbedding {
  branch: string | null
  suite: string | null
  commit_message?: string | null
  total_tests?: number | null
  passed_count?: number | null
  failed_count?: number | null
  skipped_count?: number | null
  duration_ms?: number | null
  status?: string | null
}

/**
 * Prepare execution/suite data for embedding
 *
 * Creates a semantic text representation of a test execution
 * for suite-level semantic search.
 *
 * @param execution - Execution data
 * @returns Text ready for embedding
 *
 * @example
 * prepareSuiteForEmbedding({
 *   branch: "main",
 *   suite: "e2e",
 *   commit_message: "feat: add user authentication",
 *   total_tests: 50,
 *   passed_count: 48,
 *   failed_count: 2
 * })
 * // Returns: "Branch: main\nSuite: e2e\nCommit: feat: add user authentication\nTests: 50 total, 48 passed, 2 failed"
 */
export function prepareSuiteForEmbedding(
  execution: ExecutionForEmbedding
): string {
  const parts: string[] = []

  // Branch context
  if (execution.branch) {
    parts.push(`Branch: ${execution.branch}`)
  }

  // Suite name
  if (execution.suite) {
    parts.push(`Suite: ${execution.suite}`)
  }

  // Commit message (sanitized for dynamic content)
  if (execution.commit_message) {
    // Remove ticket numbers, keep semantic content
    const sanitizedCommit = execution.commit_message
      .replace(/\[?[A-Z]+-\d+\]?\s*/g, "") // Remove JIRA-style tickets
      .replace(/#\d+/g, "") // Remove PR/issue numbers
      .slice(0, 200) // Reasonable length
      .trim()
    if (sanitizedCommit) {
      parts.push(`Commit: ${sanitizedCommit}`)
    }
  }

  // Test summary
  const summaryParts: string[] = []
  if (execution.total_tests != null) {
    summaryParts.push(`${execution.total_tests} total`)
  }
  if (execution.passed_count != null) {
    summaryParts.push(`${execution.passed_count} passed`)
  }
  if (execution.failed_count != null && execution.failed_count > 0) {
    summaryParts.push(`${execution.failed_count} failed`)
  }
  if (execution.skipped_count != null && execution.skipped_count > 0) {
    summaryParts.push(`${execution.skipped_count} skipped`)
  }
  if (summaryParts.length > 0) {
    parts.push(`Tests: ${summaryParts.join(", ")}`)
  }

  // Duration
  if (execution.duration_ms != null && execution.duration_ms > 0) {
    const minutes = Math.floor(execution.duration_ms / 60000)
    const seconds = Math.floor((execution.duration_ms % 60000) / 1000)
    const durationStr =
      minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
    parts.push(`Duration: ${durationStr}`)
  }

  // Execution status
  if (execution.status) {
    parts.push(`Status: ${execution.status}`)
  }

  return parts.join("\n")
}

/**
 * Generate a hash for embedding text to track changes
 *
 * Used for incremental re-indexing - only regenerate embedding
 * when the source text has changed.
 *
 * @param text - Text that will be embedded
 * @returns Hash string
 */
export function generateEmbeddingHash(text: string): string {
  // Simple hash using string manipulation (no crypto needed for this use case)
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}
