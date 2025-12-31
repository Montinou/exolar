import "server-only"
import { authServer } from "./auth/server"
import { neon } from "@neondatabase/serverless"

function getSql() {
  return neon(process.env.DATABASE_URL!)
}

/**
 * Session context containing user and organization information.
 * Used throughout the application to scope data access to the user's organization.
 */
export interface SessionContext {
  userId: number
  email: string
  userRole: "admin" | "viewer" // System-wide role
  organizationId: number
  organizationName: string
  organizationSlug: string
  orgRole: "owner" | "admin" | "viewer" // Org-specific role
}

/**
 * Get the current session context including organization info.
 * Call this in API routes and server components to get authenticated user context.
 *
 * @returns SessionContext or null if not authenticated
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  try {
    // Get session from Neon Auth
    const { data } = await authServer.getSession()
    if (!data?.user?.email) {
      return null
    }

    const email = data.user.email
    const sql = getSql()


    // Get user with their default org and org role
    const result = await sql`
      SELECT
        u.id as user_id,
        u.email,
        u.role as user_role,
        u.default_org_id,
        o.id as organization_id,
        o.name as organization_name,
        o.slug as organization_slug,
        om.role as org_role
      FROM dashboard_users u
      LEFT JOIN organizations o ON o.id = u.default_org_id
      LEFT JOIN organization_members om ON om.user_id = u.id AND om.organization_id = o.id
      WHERE u.email = ${email}
    `

    if (!result || result.length === 0) {
      return null
    }

    const row = result[0]

    // Handle case where user exists but has no organization assigned yet
    if (!row.organization_id) {
      console.warn(`[session-context] User ${email} has no default organization assigned`)
      return null
    }

    return {
      userId: row.user_id as number,
      email: row.email as string,
      userRole: row.user_role as "admin" | "viewer",
      organizationId: row.organization_id as number,
      organizationName: row.organization_name as string,
      organizationSlug: row.organization_slug as string,
      orgRole: (row.org_role as "owner" | "admin" | "viewer") || "viewer",
    }
  } catch (error) {
    console.error("Error getting session context:", error)
    return null
  }
}

/**
 * Check if user is an org admin (owner or admin role in their org)
 */
export function isOrgAdmin(context: SessionContext): boolean {
  return context.orgRole === "owner" || context.orgRole === "admin"
}

/**
 * Check if user is a system admin
 */
export function isSystemAdmin(context: SessionContext): boolean {
  return context.userRole === "admin"
}

/**
 * Require session context - throws if not authenticated
 */
export async function requireSessionContext(): Promise<SessionContext> {
  const context = await getSessionContext()
  if (!context) {
    throw new Error("Authentication required")
  }
  return context
}

/**
 * Require org admin - throws if not authorized
 */
export async function requireOrgAdmin(): Promise<SessionContext> {
  const context = await requireSessionContext()
  if (!isOrgAdmin(context)) {
    throw new Error("Organization admin access required")
  }
  return context
}

/**
 * Require system admin - throws if not authorized
 */
export async function requireSystemAdmin(): Promise<SessionContext> {
  const context = await requireSessionContext()
  if (!isSystemAdmin(context)) {
    throw new Error("System admin access required")
  }
  return context
}
