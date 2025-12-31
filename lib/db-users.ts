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
  created_at: string
  updated_at: string
}

export interface Invite {
  id: number
  email: string
  role: "admin" | "viewer"
  invited_by: number
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
  invitedBy?: number
): Promise<DashboardUser> {
  const sql = getSql()
  const result = await sql`
    INSERT INTO dashboard_users (email, role, invited_by)
    VALUES (${email.toLowerCase()}, ${role}, ${invitedBy ?? null})
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
  return result.count > 0
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
  invitedBy: number
): Promise<Invite> {
  const sql = getSql()
  const result = await sql`
    INSERT INTO invites (email, role, invited_by)
    VALUES (${email.toLowerCase()}, ${role}, ${invitedBy})
    ON CONFLICT (email) DO UPDATE SET
      role = ${role},
      invited_by = ${invitedBy},
      used = false,
      created_at = NOW()
    RETURNING *
  `
  return result[0] as Invite
}

/**
 * Mark invite as used
 */
export async function markInviteAsUsed(email: string): Promise<boolean> {
  const sql = getSql()
  const result = await sql`
    UPDATE invites
    SET used = true
    WHERE email = ${email.toLowerCase()}
  `
  return result.count > 0
}

/**
 * Delete invite
 */
export async function deleteInvite(inviteId: number): Promise<boolean> {
  const sql = getSql()
  const result = await sql`
    DELETE FROM invites WHERE id = ${inviteId}
  `
  return result.count > 0
}

// ============================================
// Authorization Check
// ============================================

/**
 * Check if a user is authorized to access the dashboard
 * Returns the user if authorized, null otherwise
 * Also handles first-time login from invites
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
    // Create the user from invite
    const newUser = await createUser(email, invite.role, invite.invited_by)
    // Mark invite as used
    await markInviteAsUsed(email)
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
