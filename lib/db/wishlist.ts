import { getSql } from "./connection"

/**
 * Add an email to the wishlist
 * Returns { success: true } if added, { success: false, reason: string } if failed
 */
export async function addToWishlist(
  email: string,
  name?: string
): Promise<{ success: true } | { success: false; reason: string }> {
  const sql = getSql()

  try {
    await sql`
      INSERT INTO wishlist (email, name)
      VALUES (${email.toLowerCase().trim()}, ${name?.trim() || null})
    `
    return { success: true }
  } catch (error: unknown) {
    // Check for unique constraint violation (duplicate email)
    if (
      error instanceof Error &&
      error.message.includes("duplicate key value violates unique constraint")
    ) {
      return { success: false, reason: "This email is already on the wishlist" }
    }
    console.error("Error adding to wishlist:", error)
    return { success: false, reason: "Failed to add to wishlist" }
  }
}

/**
 * Check if an email is already in the wishlist
 */
export async function isEmailInWishlist(email: string): Promise<boolean> {
  const sql = getSql()

  const result = await sql`
    SELECT 1 FROM wishlist WHERE email = ${email.toLowerCase().trim()} LIMIT 1
  `

  return result.length > 0
}

/**
 * Get all wishlist entries (for admin purposes)
 */
export async function getWishlistEntries(): Promise<
  Array<{ id: number; email: string; name: string | null; created_at: Date }>
> {
  const sql = getSql()

  const result = await sql`
    SELECT id, email, name, created_at
    FROM wishlist
    ORDER BY created_at DESC
  `

  return result as Array<{
    id: number
    email: string
    name: string | null
    created_at: Date
  }>
}

/**
 * Get wishlist count
 */
export async function getWishlistCount(): Promise<number> {
  const sql = getSql()

  const result = await sql`SELECT COUNT(*) as count FROM wishlist`

  return Number(result[0]?.count ?? 0)
}
