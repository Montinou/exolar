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
