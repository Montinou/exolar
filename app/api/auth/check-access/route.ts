import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { getSql, checkUserAccess } from "@/lib/db"

/**
 * GET /api/auth/check-access - Check if current user has access
 * Returns user info if authorized, or unauthorized status.
 *
 * Mirrors the self-heal flow in lib/session-context.ts: a stale
 * clerk_user_id (e.g. after the Neon Auth -> Clerk migration recreated
 * sessions) shouldn't lock a real user out — fall back to email lookup
 * and update the row so subsequent requests hit the fast path.
 */
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({
        authorized: false,
        authenticated: false,
        reason: "not_authenticated",
      })
    }

    const sql = getSql()

    let email: string | null = null
    const byClerkId = (await sql`
      SELECT email FROM dashboard_users WHERE clerk_user_id = ${clerkUserId}
    `) as Array<{ email: string }>

    if (byClerkId.length > 0) {
      email = byClerkId[0].email
    } else {
      const clerk = await clerkClient()
      const clerkUser = await clerk.users.getUser(clerkUserId).catch(() => null)
      const sessionEmail = clerkUser?.emailAddresses?.[0]?.emailAddress?.toLowerCase()
      if (!sessionEmail) {
        return NextResponse.json({
          authorized: false,
          authenticated: true,
          reason: "not_invited",
        })
      }

      const byEmail = (await sql`
        SELECT email FROM dashboard_users WHERE LOWER(email) = ${sessionEmail}
      `) as Array<{ email: string }>

      if (byEmail.length === 0) {
        return NextResponse.json({
          authorized: false,
          authenticated: true,
          email: sessionEmail,
          reason: "not_invited",
        })
      }

      email = byEmail[0].email
      await sql`
        UPDATE dashboard_users
        SET clerk_user_id = ${clerkUserId}
        WHERE LOWER(email) = ${sessionEmail}
          AND (clerk_user_id IS NULL OR clerk_user_id <> ${clerkUserId})
      `
      console.log(
        `[auth/check-access] self-heal: updated clerk_user_id for ${sessionEmail} to ${clerkUserId}`,
      )
    }

    const accessResult = await checkUserAccess(email)

    if (!accessResult.authorized) {
      return NextResponse.json({
        authorized: false,
        authenticated: true,
        email,
        reason: "not_invited",
      })
    }

    return NextResponse.json({
      authorized: true,
      authenticated: true,
      user: accessResult.user,
      isNewUser: accessResult.isNewUser,
    })
  } catch (error) {
    console.error("[auth/check-access] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
