import { neon } from "@neondatabase/serverless"

function getSql() {
  return neon(process.env.DATABASE_URL!)
}

// Types
export interface DashboardUser {
  id: number
  email: string
  role: "admin" | "viewer"
  invited_by: number | null
  default_org_id: number | null
  created_at: string
  updated_at: string
}

export interface Invite {
  id: number
  email: string
  role: "admin" | "viewer"
  invited_by: number
  organization_id: number | null
  used: boolean
  created_at: string
}

// ============================================
// User Queries
// ============================================

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<DashboardUser | null> {
  const sql = getSql()
  const result = await sql`
    SELECT * FROM dashboard_users WHERE email = ${email.toLowerCase()} LIMIT 1
  `
  return result.length > 0 ? (result[0] as DashboardUser) : null
}

/**
 * Get all users
 */
export async function getAllUsers(): Promise<DashboardUser[]> {
  const sql = getSql()
  const result = await sql`
    SELECT * FROM dashboard_users ORDER BY created_at DESC
  `
  return result as DashboardUser[]
}

/**
 * Create a new user (when they first log in after being invited)
 */
export async function createUser(
  email: string,
  role: "admin" | "viewer",
  invitedBy?: number,
  defaultOrgId?: number
): Promise<DashboardUser> {
  const sql = getSql()
  const result = await sql`
    INSERT INTO dashboard_users (email, role, invited_by, default_org_id)
    VALUES (${email.toLowerCase()}, ${role}, ${invitedBy ?? null}, ${defaultOrgId ?? null})
    RETURNING *
  `
  return result[0] as DashboardUser
}

/**
 * Update user role
 */
export async function updateUserRole(
  userId: number,
  role: "admin" | "viewer"
): Promise<DashboardUser | null> {
  const sql = getSql()
  const result = await sql`
    UPDATE dashboard_users
    SET role = ${role}, updated_at = NOW()
    WHERE id = ${userId}
    RETURNING *
  `
  return result.length > 0 ? (result[0] as DashboardUser) : null
}

/**
 * Delete user
 */
export async function deleteUser(userId: number): Promise<boolean> {
  const sql = getSql()
  const result = await sql`
    DELETE FROM dashboard_users WHERE id = ${userId}
  `
  return result.length > 0
}

// ============================================
// Invite Queries
// ============================================

/**
 * Get invite by email
 */
export async function getInviteByEmail(email: string): Promise<Invite | null> {
  const sql = getSql()
  const result = await sql`
    SELECT * FROM invites
    WHERE email = ${email.toLowerCase()} AND used = false
    LIMIT 1
  `
  return result.length > 0 ? (result[0] as Invite) : null
}

/**
 * Get all invites
 */
export async function getAllInvites(): Promise<Invite[]> {
  const sql = getSql()
  const result = await sql`
    SELECT * FROM invites ORDER BY created_at DESC
  `
  return result as Invite[]
}

/**
 * Create a new invite
 */
export async function createInvite(
  email: string,
  role: "admin" | "viewer",
  invitedBy: number,
  organizationId?: number
): Promise<Invite> {
  const sql = getSql()
  const result = await sql`
    INSERT INTO invites (email, role, invited_by, organization_id)
    VALUES (${email.toLowerCase()}, ${role}, ${invitedBy}, ${organizationId ?? null})
    ON CONFLICT (email) DO UPDATE SET
      role = ${role},
      invited_by = ${invitedBy},
      organization_id = ${organizationId ?? null},
      used = false,
      created_at = NOW()
    RETURNING *
  `
  return result[0] as Invite
}

/**
 * Mark invite as used by ID
 */
export async function markInviteAsUsedById(inviteId: number): Promise<boolean> {
  const sql = getSql()
  const result = await sql`
    UPDATE invites
    SET used = true
    WHERE id = ${inviteId}
  `
  return (result as unknown as { count: number }).count > 0
}

/**
 * Mark invite as used by email (legacy support)
 */
export async function markInviteAsUsed(email: string): Promise<boolean> {
  const sql = getSql()
  const result = await sql`
    UPDATE invites
    SET used = true
    WHERE email = ${email.toLowerCase()}
  `
  return (result as unknown as { count: number }).count > 0
}

/**
 * Delete invite
 */
export async function deleteInvite(inviteId: number): Promise<boolean> {
  const sql = getSql()
  const result = await sql`
    DELETE FROM invites WHERE id = ${inviteId}
  `
  return result.length > 0
}

// ============================================
// Organization Helpers
// ============================================

/**
 * Get the default organization ID (Attorneyshare)
 * Used as fallback when invite doesn't specify an org
 */
async function getDefaultOrgId(): Promise<number> {
  const sql = getSql()
  const result = await sql`
    SELECT id FROM organizations WHERE slug = 'attorneyshare' LIMIT 1
  `
  return result.length > 0 ? (result[0].id as number) : 1
}

/**
 * Create a user from an invite, assigning them to the appropriate organization
 */
async function createUserFromInvite(
  email: string,
  invite: Invite
): Promise<DashboardUser> {
  const sql = getSql()

  // Determine which org to assign
  // If invite has organization_id, use that; otherwise use default (Attorneyshare)
  const orgId = invite.organization_id || (await getDefaultOrgId())

  // Create the user with default_org_id
  const userResult = await sql`
    INSERT INTO dashboard_users (email, role, invited_by, default_org_id)
    VALUES (${email.toLowerCase()}, ${invite.role}, ${invite.invited_by}, ${orgId})
    RETURNING *
  `

  const user = userResult[0] as DashboardUser

  // Add user to organization as member
  // Map user role to org role: admin -> admin, viewer -> viewer
  const orgRole = invite.role === "admin" ? "admin" : "viewer"
  await sql`
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (${orgId}, ${user.id}, ${orgRole})
    ON CONFLICT (organization_id, user_id) DO NOTHING
  `

  // Mark invite as used
  await markInviteAsUsedById(invite.id)

  return user
}

// ============================================
// Authorization Check
// ============================================

/**
 * Check if a user is authorized to access the dashboard
 * Returns the user if authorized, null otherwise
 * Also handles first-time login from invites, assigning user to organization
 */
export async function checkUserAccess(email: string): Promise<{
  authorized: boolean
  user: DashboardUser | null
  isNewUser: boolean
}> {
  // First check if user exists in dashboard_users
  const existingUser = await getUserByEmail(email)
  if (existingUser) {
    return { authorized: true, user: existingUser, isNewUser: false }
  }

  // Check if there's a valid invite
  const invite = await getInviteByEmail(email)
  if (invite && !invite.used) {
    // Create the user from invite (includes org assignment)
    const newUser = await createUserFromInvite(email, invite)
    return { authorized: true, user: newUser, isNewUser: true }
  }

  // No user and no invite - not authorized
  return { authorized: false, user: null, isNewUser: false }
}

/**
 * Check if user is admin
 */
export async function isAdmin(email: string): Promise<boolean> {
  const user = await getUserByEmail(email)
  return user?.role === "admin"
}
