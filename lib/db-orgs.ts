import { getSql } from "./db"

// ============================================
// Types
// ============================================

export interface Organization {
  id: number
  name: string
  slug: string
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: number
  organization_id: number
  user_id: number
  role: "owner" | "admin" | "viewer"
  joined_at: string
  // Joined fields
  user_email?: string
  user_name?: string
}

export interface OrganizationWithRole extends Organization {
  user_role?: "owner" | "admin" | "viewer"
}

// ============================================
// Organization CRUD
// ============================================

/**
 * Create a new organization and add creator as owner
 */
export async function createOrganization(
  name: string,
  slug: string,
  createdBy: number
): Promise<Organization> {
  const sql = getSql()
  const result = await sql`
    INSERT INTO organizations (name, slug, created_by)
    VALUES (${name}, ${slug}, ${createdBy})
    RETURNING *
  `

  const org = result[0] as Organization

  // Add creator as owner
  await sql`
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (${org.id}, ${createdBy}, 'owner')
  `

  return org
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(id: number): Promise<Organization | null> {
  const sql = getSql()
  const result = await sql`SELECT * FROM organizations WHERE id = ${id}`
  return result.length > 0 ? (result[0] as Organization) : null
}

/**
 * Get organization by slug
 */
export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  const sql = getSql()
  const result = await sql`SELECT * FROM organizations WHERE slug = ${slug}`
  return result.length > 0 ? (result[0] as Organization) : null
}

/**
 * Update organization
 */
export async function updateOrganization(
  id: number,
  updates: { name?: string; slug?: string }
): Promise<Organization | null> {
  const sql = getSql()
  const result = await sql`
    UPDATE organizations
    SET
      name = COALESCE(${updates.name ?? null}, name),
      slug = COALESCE(${updates.slug ?? null}, slug),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return result.length > 0 ? (result[0] as Organization) : null
}

/**
 * Delete organization
 * Note: CASCADE will delete members, but test data needs handling via triggers or explicit cleanup
 */
export async function deleteOrganization(id: number): Promise<boolean> {
  const sql = getSql()
  const result = await sql`DELETE FROM organizations WHERE id = ${id}`
  return (result as unknown as { count: number }).count > 0
}

/**
 * Get all organizations (for system admins)
 */
export async function getAllOrganizations(): Promise<Organization[]> {
  const sql = getSql()
  const result = await sql`
    SELECT o.*,
      (SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id) as member_count
    FROM organizations o
    ORDER BY o.name ASC
  `
  return result as Organization[]
}

// ============================================
// Organization Members
// ============================================

/**
 * Get all members of an organization
 */
export async function getOrganizationMembers(orgId: number): Promise<OrganizationMember[]> {
  const sql = getSql()
  const result = await sql`
    SELECT
      om.*,
      u.email as user_email
    FROM organization_members om
    JOIN dashboard_users u ON u.id = om.user_id
    WHERE om.organization_id = ${orgId}
    ORDER BY om.role, om.joined_at
  `
  return result as OrganizationMember[]
}

/**
 * Add a user to an organization
 */
export async function addOrganizationMember(
  orgId: number,
  userId: number,
  role: "owner" | "admin" | "viewer" = "viewer"
): Promise<OrganizationMember> {
  const sql = getSql()
  const result = await sql`
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (${orgId}, ${userId}, ${role})
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = ${role}
    RETURNING *
  `
  return result[0] as OrganizationMember
}

/**
 * Update member role
 */
export async function updateMemberRole(
  orgId: number,
  userId: number,
  newRole: "owner" | "admin" | "viewer"
): Promise<OrganizationMember | null> {
  const sql = getSql()
  const result = await sql`
    UPDATE organization_members
    SET role = ${newRole}
    WHERE organization_id = ${orgId} AND user_id = ${userId}
    RETURNING *
  `
  return result.length > 0 ? (result[0] as OrganizationMember) : null
}

/**
 * Remove member from organization
 */
export async function removeMember(orgId: number, userId: number): Promise<boolean> {
  const sql = getSql()
  const result = await sql`
    DELETE FROM organization_members
    WHERE organization_id = ${orgId} AND user_id = ${userId}
  `
  return (result as unknown as { count: number }).count > 0
}

/**
 * Get all organizations a user belongs to
 */
export async function getUserOrganizations(userId: number): Promise<OrganizationWithRole[]> {
  const sql = getSql()
  const result = await sql`
    SELECT o.*, om.role as user_role
    FROM organizations o
    JOIN organization_members om ON om.organization_id = o.id
    WHERE om.user_id = ${userId}
    ORDER BY o.name
  `
  return result as OrganizationWithRole[]
}

/**
 * Check if user is member of organization
 */
export async function isUserMemberOfOrg(userId: number, orgId: number): Promise<boolean> {
  const sql = getSql()
  const result = await sql`
    SELECT 1 FROM organization_members
    WHERE user_id = ${userId} AND organization_id = ${orgId}
    LIMIT 1
  `
  return result.length > 0
}

// ============================================
// Organization Invites
// ============================================

/**
 * Create org-specific invite
 * Note: Uses existing invites table, storing org context
 */
export async function createOrgInvite(
  orgId: number,
  email: string,
  role: "admin" | "viewer",
  invitedBy: number
): Promise<{ id: number; email: string; role: string; organization_id: number }> {
  const sql = getSql()
  const result = await sql`
    INSERT INTO invites (email, role, invited_by, organization_id)
    VALUES (${email.toLowerCase()}, ${role}, ${invitedBy}, ${orgId})
    ON CONFLICT (email) DO UPDATE SET
      role = ${role},
      organization_id = ${orgId},
      invited_by = ${invitedBy},
      used = false
    RETURNING id, email, role, organization_id
  `
  return result[0] as { id: number; email: string; role: string; organization_id: number }
}

/**
 * Get pending invites for an organization
 */
export async function getOrgInvites(orgId: number): Promise<Array<{
  id: number
  email: string
  role: string
  created_at: string
}>> {
  const sql = getSql()
  const result = await sql`
    SELECT id, email, role, created_at
    FROM invites
    WHERE organization_id = ${orgId} AND used = false
    ORDER BY created_at DESC
  `
  return result as Array<{ id: number; email: string; role: string; created_at: string }>
}
