import { v4 as uuidv4 } from "uuid"
import type { MockResponseRule, MockRequestContext } from "@/lib/types"

// ============================================
// Path Matching
// ============================================

/**
 * Match a path pattern against an actual path
 * Supports:
 * - Exact match: /users
 * - Parameters: /users/:id → captures id
 * - Wildcards: /api/* → matches any suffix
 *
 * @returns Object with params if matched, null if not matched
 */
export function matchPath(
  pattern: string,
  path: string
): { matched: boolean; params: Record<string, string> } {
  const patternParts = pattern.split("/").filter(Boolean)
  const pathParts = path.split("/").filter(Boolean)
  const params: Record<string, string> = {}

  // Check for wildcard at end
  const hasWildcard = patternParts[patternParts.length - 1] === "*"
  if (hasWildcard) {
    patternParts.pop() // Remove wildcard for comparison

    // Path must have at least as many parts as pattern (before wildcard)
    if (pathParts.length < patternParts.length) {
      return { matched: false, params: {} }
    }

    // Compare up to the wildcard
    for (let i = 0; i < patternParts.length; i++) {
      const result = matchPart(patternParts[i], pathParts[i])
      if (!result.matched) {
        return { matched: false, params: {} }
      }
      if (result.paramName) {
        params[result.paramName] = pathParts[i]
      }
    }

    // Capture rest as wildcard
    params["*"] = "/" + pathParts.slice(patternParts.length).join("/")
    return { matched: true, params }
  }

  // Exact length match required (no wildcard)
  if (patternParts.length !== pathParts.length) {
    return { matched: false, params: {} }
  }

  // Compare each part
  for (let i = 0; i < patternParts.length; i++) {
    const result = matchPart(patternParts[i], pathParts[i])
    if (!result.matched) {
      return { matched: false, params: {} }
    }
    if (result.paramName) {
      params[result.paramName] = pathParts[i]
    }
  }

  return { matched: true, params }
}

/**
 * Match a single path part
 */
function matchPart(
  pattern: string,
  actual: string
): { matched: boolean; paramName?: string } {
  // Parameter pattern (:paramName)
  if (pattern.startsWith(":")) {
    return { matched: true, paramName: pattern.slice(1) }
  }

  // Exact match
  return { matched: pattern === actual }
}

// ============================================
// Rule Matching
// ============================================

/**
 * Match a response rule against a request context
 * All conditions must match (AND logic)
 */
export function matchRule(
  rule: MockResponseRule,
  context: MockRequestContext
): boolean {
  // Match headers
  if (rule.match_headers && !matchObject(rule.match_headers, context.headers)) {
    return false
  }

  // Match query params
  if (rule.match_query && !matchObject(rule.match_query, context.query)) {
    return false
  }

  // Match body JSON paths
  if (rule.match_body && !matchJsonPaths(rule.match_body, context.body)) {
    return false
  }

  // Match body contains
  if (rule.match_body_contains && !matchBodyContains(rule.match_body_contains, context.body)) {
    return false
  }

  return true
}

/**
 * Match key-value pairs with support for wildcards and regex
 * Patterns:
 * - "*" → matches any value
 * - "prefix*" → starts with prefix
 * - "*suffix" → ends with suffix
 * - "/regex/" → regex match
 */
function matchObject(
  pattern: Record<string, string>,
  actual: Record<string, string>
): boolean {
  for (const [key, expectedValue] of Object.entries(pattern)) {
    // Try case-insensitive key lookup for headers
    const actualValue = actual[key] ?? actual[key.toLowerCase()] ?? actual[key.toUpperCase()]

    if (actualValue === undefined) {
      return false
    }

    if (!matchValue(expectedValue, actualValue)) {
      return false
    }
  }

  return true
}

/**
 * Match a single value with pattern support
 */
function matchValue(pattern: string, actual: string): boolean {
  // Exact wildcard
  if (pattern === "*") {
    return true
  }

  // Regex pattern /regex/
  if (pattern.startsWith("/") && pattern.endsWith("/")) {
    try {
      const regex = new RegExp(pattern.slice(1, -1))
      return regex.test(actual)
    } catch {
      return pattern === actual
    }
  }

  // Prefix wildcard: "Bearer *"
  if (pattern.endsWith("*")) {
    return actual.startsWith(pattern.slice(0, -1))
  }

  // Suffix wildcard: "*@test.com"
  if (pattern.startsWith("*")) {
    return actual.endsWith(pattern.slice(1))
  }

  // Exact match
  return pattern === actual
}

/**
 * Match JSON paths against request body
 * Supports dot notation: "user.email", "items[0].id"
 */
function matchJsonPaths(
  patterns: Record<string, unknown>,
  body: unknown
): boolean {
  if (typeof body !== "object" || body === null) {
    return false
  }

  for (const [path, expectedValue] of Object.entries(patterns)) {
    const actualValue = getJsonPath(body, path)

    if (actualValue === undefined) {
      return false
    }

    // Convert to string for pattern matching
    const actualStr = typeof actualValue === "string" ? actualValue : JSON.stringify(actualValue)
    const expectedStr = typeof expectedValue === "string" ? expectedValue : JSON.stringify(expectedValue)

    if (!matchValue(expectedStr, actualStr)) {
      return false
    }
  }

  return true
}

/**
 * Get value at JSON path
 * Supports: "user.name", "items[0]", "data.users[0].email"
 */
function getJsonPath(obj: unknown, path: string): unknown {
  const parts = path.split(/\.|\[|\]/).filter(Boolean)
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }

    if (typeof current !== "object") {
      return undefined
    }

    // Array index
    if (/^\d+$/.test(part)) {
      if (!Array.isArray(current)) {
        return undefined
      }
      current = current[parseInt(part, 10)]
    } else {
      // Object property
      current = (current as Record<string, unknown>)[part]
    }
  }

  return current
}

/**
 * Check if body contains a substring
 */
function matchBodyContains(pattern: string, body: unknown): boolean {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body)
  return bodyStr.includes(pattern)
}

// ============================================
// Response Templating
// ============================================

/**
 * Process response body templating
 * Supports:
 * - {{request.body.name}} → request body field
 * - {{request.query.page}} → query parameter
 * - {{request.headers.authorization}} → request header
 * - {{request.params.id}} → URL parameter
 * - {{timestamp}} → ISO timestamp
 * - {{uuid}} → random UUID
 * - {{random.number}} → random number
 * - {{random.string}} → random string
 */
export function processTemplate(
  template: string,
  context: MockRequestContext
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const trimmedPath = path.trim()

    // Built-in helpers
    if (trimmedPath === "timestamp") {
      return new Date().toISOString()
    }

    if (trimmedPath === "uuid") {
      return uuidv4()
    }

    if (trimmedPath === "random.number") {
      return String(Math.floor(Math.random() * 1000000))
    }

    if (trimmedPath === "random.string") {
      return Math.random().toString(36).substring(2, 15)
    }

    // Request context paths
    if (trimmedPath.startsWith("request.")) {
      const requestPath = trimmedPath.slice(8) // Remove "request."

      if (requestPath.startsWith("body.")) {
        const bodyPath = requestPath.slice(5)
        const value = getJsonPath(context.body, bodyPath)
        return value !== undefined ? String(value) : match
      }

      if (requestPath.startsWith("query.")) {
        const queryKey = requestPath.slice(6)
        return context.query[queryKey] ?? match
      }

      if (requestPath.startsWith("headers.")) {
        const headerKey = requestPath.slice(8)
        return context.headers[headerKey] ?? context.headers[headerKey.toLowerCase()] ?? match
      }

      if (requestPath.startsWith("params.")) {
        const paramKey = requestPath.slice(7)
        return context.params[paramKey] ?? match
      }

      // Direct access: request.method, etc.
      if (requestPath === "method") {
        return "{{request.method}}" // Not available in current context
      }
    }

    // Return original if not matched
    return match
  })
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a URL-safe slug from a name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
}

/**
 * Validate a slug format
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && slug.length > 0 && slug.length <= 50
}

/**
 * Parse request body safely
 */
export async function parseRequestBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? ""

  try {
    if (contentType.includes("application/json")) {
      return await request.json()
    }

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text()
      const params = new URLSearchParams(text)
      const result: Record<string, string> = {}
      params.forEach((value, key) => {
        result[key] = value
      })
      return result
    }

    // Return raw text for other content types
    return await request.text()
  } catch {
    return null
  }
}

/**
 * Convert headers to plain object
 */
export function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value
  })
  return result
}

/**
 * Convert URLSearchParams to plain object
 */
export function searchParamsToObject(params: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {}
  params.forEach((value, key) => {
    result[key] = value
  })
  return result
}
