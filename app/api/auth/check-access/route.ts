import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getSql } from "@/lib/db"
import { checkUserAccess } from "@/lib/db"

/**
 * GET /api/auth/check-access - Check if current user has access
 * Returns user info if authorized, or unauthorized status
 */
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({
        authorized: false,
        authenticated: false,
        reason: "not_authenticated"
      })
    }

    // Look up email by Clerk user ID
    const sql = getSql()
    const userResult = await sql`
      SELECT email FROM dashboard_users WHERE clerk_user_id = ${clerkUserId}
    `

    if (!userResult.length) {
      return NextResponse.json({
        authorized: false,
        authenticated: true,
        reason: "not_invited"
      })
    }

    const email = userResult[0].email as string
    const accessResult = await checkUserAccess(email)

    if (!accessResult.authorized) {
      return NextResponse.json({
        authorized: false,
        authenticated: true,
        email,
        reason: "not_invited"
      })
    }

    return NextResponse.json({
      authorized: true,
      authenticated: true,
      user: accessResult.user,
      isNewUser: accessResult.isNewUser
    })
  } catch (error) {
    console.error("[auth/check-access] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
