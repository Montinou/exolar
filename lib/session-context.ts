import "server-only"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { getSql } from "./db"

/**
 * Session context containing user and organization information.
 * Used throughout the application to scope data access to the user's organization.
 */
export interface SessionContext {
  userId: number
  email: string
  userRole: "admin" | "viewer" // System-wide role
  isSuperadmin: boolean // Full cross-org access (only agusmontoya@gmail.com)
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
type ContextRow = Record<string, unknown>

function shapeContext(row: ContextRow): SessionContext | null {
  if (!row.organization_id) return null
  return {
    userId: row.user_id as number,
    email: row.email as string,
    userRole: row.user_role as "admin" | "viewer",
    isSuperadmin: row.is_superadmin === true,
    organizationId: row.organization_id as number,
    organizationName: row.organization_name as string,
    organizationSlug: row.organization_slug as string,
    orgRole: (row.org_role as "owner" | "admin" | "viewer") || "viewer",
  }
}

export async function getSessionContext(): Promise<SessionContext | null> {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return null
    }

    const sql = getSql()

    // Primary lookup: clerk_user_id (fast path, hits the unique index).
    const byClerkId = (await sql`
      SELECT
        u.id as user_id, u.email, u.role as user_role,
        u.is_superadmin, u.default_org_id,
        o.id as organization_id, o.name as organization_name, o.slug as organization_slug,
        om.role as org_role
      FROM dashboard_users u
      LEFT JOIN organizations o ON o.id = u.default_org_id
      LEFT JOIN organization_members om ON om.user_id = u.id AND om.organization_id = o.id
      WHERE u.clerk_user_id = ${clerkUserId}
    `) as ContextRow[]

    if (byClerkId.length > 0) {
      const ctx = shapeContext(byClerkId[0])
      if (ctx) return ctx
      console.warn(`[session-context] User ${clerkUserId} has no default organization assigned`)
      return null
    }

    // Fallback / self-heal: clerk_user_id miss can happen if the Clerk user
    // was recreated (different user_id) or migrated from another auth system.
    // The dashboard_users row may still exist under the same email. Look up by
    // email, then update clerk_user_id so subsequent requests hit the fast path.
    const clerk = await clerkClient()
    const clerkUser = await clerk.users.getUser(clerkUserId).catch(() => null)
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress?.toLowerCase()
    if (!email) {
      console.warn(`[session-context] Clerk user ${clerkUserId} has no email; can't self-heal`)
      return null
    }

    const byEmail = (await sql`
      SELECT
        u.id as user_id, u.email, u.role as user_role,
        u.is_superadmin, u.default_org_id,
        o.id as organization_id, o.name as organization_name, o.slug as organization_slug,
        om.role as org_role
      FROM dashboard_users u
      LEFT JOIN organizations o ON o.id = u.default_org_id
      LEFT JOIN organization_members om ON om.user_id = u.id AND om.organization_id = o.id
      WHERE LOWER(u.email) = ${email}
    `) as ContextRow[]

    if (byEmail.length === 0) {
      console.warn(
        `[session-context] No dashboard_users row for clerk=${clerkUserId} email=${email}`,
      )
      return null
    }

    // Heal the mismatched clerk_user_id so the next request hits the fast path.
    await sql`
      UPDATE dashboard_users
      SET clerk_user_id = ${clerkUserId}
      WHERE LOWER(email) = ${email}
        AND (clerk_user_id IS NULL OR clerk_user_id <> ${clerkUserId})
    `
    console.log(
      `[session-context] self-heal: updated clerk_user_id for ${email} to ${clerkUserId}`,
    )

    const ctx = shapeContext(byEmail[0])
    if (ctx) return ctx
    console.warn(`[session-context] User ${email} has no default organization assigned`)
    return null
  } catch (error) {
    console.error("[session-context] Error getting session:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 3).join("\n") : undefined,
    })
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
 * Check if user is a superadmin (full cross-org access)
 */
export function isSuperadmin(context: SessionContext): boolean {
  return context.isSuperadmin === true
}

/**
 * Check if user is a system admin (superadmin with full access)
 * Note: Now checks isSuperadmin instead of userRole === "admin"
 * Regular admins no longer have system-wide access
 */
export function isSystemAdmin(context: SessionContext): boolean {
  return context.isSuperadmin === true
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

/**
 * Require superadmin - throws if not authorized
 * Use this for operations that need full cross-org access
 */
export async function requireSuperadmin(): Promise<SessionContext> {
  const context = await requireSessionContext()
  if (!isSuperadmin(context)) {
    throw new Error("Superadmin access required")
  }
  return context
}
