/**
 * Neon Auth Token Validation for MCP Server
 *
 * Validates JWT tokens issued by Neon Auth and extracts user/org context.
 * Uses JWKS for signature verification.
 */

import * as jose from "jose"
import { getSql } from "../db/connection.js"

export interface AuthContext {
  userId: number
  email: string
  organizationId: number
  organizationSlug: string
  orgRole: "owner" | "admin" | "viewer"
  userRole: "admin" | "viewer"
}

// Neon Auth JWKS endpoint - get from Neon dashboard
const NEON_AUTH_JWKS_URL =
  process.env.NEON_AUTH_JWKS_URL || "https://auth.neon.tech/.well-known/jwks.json"

let jwks: jose.JWTVerifyGetKey | null = null

async function getJWKS(): Promise<jose.JWTVerifyGetKey> {
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(new URL(NEON_AUTH_JWKS_URL))
  }
  return jwks
}

/**
 * Validate Neon Auth token and return user/org context.
 * Returns null if token is invalid or user not found.
 */
export async function validateNeonAuthToken(token: string): Promise<AuthContext | null> {
  try {
    // 1. Verify JWT signature with Neon's JWKS
    const keySet = await getJWKS()
    const { payload } = await jose.jwtVerify(token, keySet)

    // 2. Extract email from token
    const email = payload.email as string
    if (!email) {
      console.error("[neon-auth] Token missing email claim")
      return null
    }

    // 3. Look up user and org membership in our database
    const sql = getSql()

    const result = await sql`
      SELECT
        u.id as user_id,
        u.email,
        u.role as user_role,
        u.default_org_id,
        o.id as organization_id,
        o.slug as organization_slug,
        om.role as org_role
      FROM dashboard_users u
      LEFT JOIN organizations o ON o.id = u.default_org_id
      LEFT JOIN organization_members om ON om.user_id = u.id AND om.organization_id = o.id
      WHERE u.email = ${email}
    `

    if (!result || result.length === 0) {
      console.error(`[neon-auth] User not found for email: ${email}`)
      return null
    }

    const userInfo = result[0]

    if (!userInfo.organization_id) {
      console.error(`[neon-auth] User ${email} has no organization assigned`)
      return null
    }

    return {
      userId: userInfo.user_id as number,
      email: userInfo.email as string,
      organizationId: userInfo.organization_id as number,
      organizationSlug: userInfo.organization_slug as string,
      orgRole: (userInfo.org_role as "owner" | "admin" | "viewer") || "viewer",
      userRole: userInfo.user_role as "admin" | "viewer",
    }
  } catch (error) {
    console.error("[neon-auth] Token validation failed:", error)
    return null
  }
}

/**
 * Validate token and require org admin access.
 * Returns null if not authorized.
 */
export async function requireOrgAdmin(token: string): Promise<AuthContext | null> {
  const context = await validateNeonAuthToken(token)
  if (!context) return null

  if (context.orgRole !== "owner" && context.orgRole !== "admin") {
    console.error(`[neon-auth] User ${context.email} is not an org admin`)
    return null
  }

  return context
}
