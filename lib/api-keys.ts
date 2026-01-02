/**
 * Organization API Key Utilities
 *
 * Handles generation, hashing, and validation of API keys for CI/CD ingestion.
 * Keys are prefixed with "aestra_" and stored as SHA-256 hashes.
 */

import crypto from "crypto"
import { getSql } from "./db"

const API_KEY_PREFIX = "aestra_"

export interface GeneratedApiKey {
  key: string      // Full key (shown once to user)
  hash: string     // SHA-256 hash (stored in DB)
  prefix: string   // Display prefix (e.g., "aestra_abc1...")
}

export interface ValidatedApiKey {
  id: number
  organizationId: number
  name: string
}

/**
 * Generate a new API key with hash and display prefix
 */
export function generateApiKey(): GeneratedApiKey {
  // Generate 24 random bytes encoded as base64url (32 chars)
  const randomPart = crypto.randomBytes(24).toString("base64url")
  const key = `${API_KEY_PREFIX}${randomPart}`

  // Hash the full key for storage
  const hash = hashApiKey(key)

  // Store first 16 chars as display prefix
  const prefix = key.slice(0, 16)

  return { key, hash, prefix }
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex")
}

/**
 * Validate an API key from Authorization header and return org info
 * Returns null if invalid, expired, or revoked
 */
export async function validateOrgApiKey(
  authHeader: string | null
): Promise<ValidatedApiKey | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return null
  }

  const key = authHeader.slice(7)

  // Must be an aestra_ prefixed key
  if (!key.startsWith(API_KEY_PREFIX)) {
    return null
  }

  const hash = hashApiKey(key)
  const sql = getSql()

  // Look up the key by hash
  const result = await sql`
    SELECT
      id,
      organization_id,
      name,
      revoked_at,
      expires_at
    FROM organization_api_keys
    WHERE key_hash = ${hash}
  `

  if (result.length === 0) {
    return null
  }

  const apiKey = result[0]

  // Check if revoked
  if (apiKey.revoked_at) {
    return null
  }

  // Check if expired
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return null
  }

  // Update last_used_at (fire and forget, don't await)
  sql`
    UPDATE organization_api_keys
    SET last_used_at = NOW()
    WHERE id = ${apiKey.id}
  `.catch(() => {
    // Ignore errors on usage tracking
  })

  return {
    id: apiKey.id as number,
    organizationId: apiKey.organization_id as number,
    name: apiKey.name as string,
  }
}

/**
 * Check if an Authorization header contains a valid aestra API key format
 * (does not validate against DB, just format check)
 */
export function isAestraApiKey(authHeader: string | null): boolean {
  if (!authHeader?.startsWith("Bearer ")) {
    return false
  }
  const key = authHeader.slice(7)
  return key.startsWith(API_KEY_PREFIX)
}
