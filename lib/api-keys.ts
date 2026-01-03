/**
 * Organization API Key Utilities
 *
 * Handles generation, hashing, and validation of API keys for CI/CD ingestion.
 * Keys are prefixed with "exolar_" and stored as SHA-256 hashes.
 */

import crypto from "crypto"
import { getApiKeyByHash, updateApiKeyLastUsed } from "./db"

const API_KEY_PREFIX = "exolar_"

export interface GeneratedApiKey {
  key: string      // Full key (shown once to user)
  hash: string     // SHA-256 hash (stored in DB)
  prefix: string   // Display prefix (e.g., "exolar_abc1...")
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

  // Must be an exolar_ prefixed key
  if (!key.startsWith(API_KEY_PREFIX)) {
    return null
  }

  const hash = hashApiKey(key)

  // Look up the key by hash
  const apiKey = await getApiKeyByHash(hash)

  if (!apiKey) {
    return null
  }

  // Check if revoked
  if (apiKey.revoked_at) {
    return null
  }

  // Check if expired
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return null
  }

  // Update last_used_at (fire and forget, don't await)
  updateApiKeyLastUsed(apiKey.id).catch(() => {
    // Ignore errors on usage tracking
  })

  return {
    id: apiKey.id,
    organizationId: apiKey.organization_id,
    name: apiKey.name,
  }
}

/**
 * Check if an Authorization header contains a valid Exolar API key format
 * (does not validate against DB, just format check)
 */
export function isExolarApiKey(authHeader: string | null): boolean {
  if (!authHeader?.startsWith("Bearer ")) {
    return false
  }
  const key = authHeader.slice(7)
  return key.startsWith(API_KEY_PREFIX)
}
