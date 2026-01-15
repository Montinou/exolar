import { getSql } from "./connection"
import type { OrgApiKey, OrgApiKeyWithHash } from "./types"

/**
 * Create a new API key for an organization
 */
export async function createApiKey(
  organizationId: number,
  name: string,
  keyHash: string,
  keyPrefix: string,
  createdBy: number | null
): Promise<OrgApiKey> {
  const sql = getSql()

  const result = await sql`
    INSERT INTO organization_api_keys (
      organization_id,
      name,
      key_hash,
      key_prefix,
      created_by
    ) VALUES (
      ${organizationId},
      ${name},
      ${keyHash},
      ${keyPrefix},
      ${createdBy}
    )
    RETURNING id, organization_id, name, key_prefix, created_by, created_at, last_used_at, expires_at, revoked_at
  `

  return result[0] as OrgApiKey
}

/**
 * Get all API keys for an organization (excludes key_hash for security)
 */
export async function getApiKeysByOrg(organizationId: number): Promise<OrgApiKey[]> {
  const sql = getSql()

  const result = await sql`
    SELECT
      id,
      organization_id,
      name,
      key_prefix,
      created_by,
      created_at,
      last_used_at,
      expires_at,
      revoked_at
    FROM organization_api_keys
    WHERE organization_id = ${organizationId}
    ORDER BY created_at DESC
  `

  return result as OrgApiKey[]
}

/**
 * Get API keys created by a specific user (for non-admin access)
 */
export async function getApiKeysByUser(
  organizationId: number,
  userId: number
): Promise<OrgApiKey[]> {
  const sql = getSql()

  const result = await sql`
    SELECT
      id,
      organization_id,
      name,
      key_prefix,
      created_by,
      created_at,
      last_used_at,
      expires_at,
      revoked_at
    FROM organization_api_keys
    WHERE organization_id = ${organizationId}
      AND created_by = ${userId}
    ORDER BY created_at DESC
  `

  return result as OrgApiKey[]
}

/**
 * Get an API key by its hash (for validation)
 */
export async function getApiKeyByHash(keyHash: string): Promise<OrgApiKeyWithHash | null> {
  const sql = getSql()

  const result = await sql`
    SELECT *
    FROM organization_api_keys
    WHERE key_hash = ${keyHash}
  `

  return result.length > 0 ? (result[0] as OrgApiKeyWithHash) : null
}

/**
 * Revoke an API key (soft delete)
 */
export async function revokeApiKey(keyId: number, organizationId: number): Promise<boolean> {
  const sql = getSql()

  const result = await sql`
    UPDATE organization_api_keys
    SET revoked_at = NOW()
    WHERE id = ${keyId}
      AND organization_id = ${organizationId}
      AND revoked_at IS NULL
    RETURNING id
  `

  return result.length > 0
}

/**
 * Update last_used_at timestamp for an API key
 */
export async function updateApiKeyLastUsed(keyId: number): Promise<void> {
  const sql = getSql()

  await sql`
    UPDATE organization_api_keys
    SET last_used_at = NOW()
    WHERE id = ${keyId}
  `
}
