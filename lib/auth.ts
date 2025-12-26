/**
 * API Key authentication for data ingestion endpoint
 *
 * The API key should be set in DASHBOARD_API_KEY environment variable
 * and passed in the Authorization header as: Bearer <api-key>
 */

/**
 * Validates the Authorization header against the DASHBOARD_API_KEY env var
 * @param authHeader The full Authorization header value (e.g., "Bearer abc123")
 * @returns true if valid, false otherwise
 */
export function validateApiKey(authHeader: string | null): boolean {
  if (!authHeader) {
    return false
  }

  const apiKey = process.env.DASHBOARD_API_KEY
  if (!apiKey) {
    console.error("[auth] DASHBOARD_API_KEY environment variable is not set")
    return false
  }

  // Extract token from "Bearer <token>" format
  const parts = authHeader.split(" ")
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return false
  }

  const token = parts[1]

  // Constant-time comparison to prevent timing attacks
  if (token.length !== apiKey.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ apiKey.charCodeAt(i)
  }

  return result === 0
}

/**
 * Extracts the API key from an Authorization header
 * @param authHeader The full Authorization header value
 * @returns The token or null if invalid format
 */
export function extractApiKey(authHeader: string | null): string | null {
  if (!authHeader) {
    return null
  }

  const parts = authHeader.split(" ")
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null
  }

  return parts[1]
}
