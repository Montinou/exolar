import { NextResponse } from "next/server"
import { authServer } from "@/lib/auth/server"
import { checkUserAccess } from "@/lib/db-users"

/**
 * GET /api/auth/check-access - Check if current user has access
 * Returns user info if authorized, or unauthorized status
 */
export async function GET() {
  try {
    const { data } = await authServer.getSession()

    // Not logged in with Neon Auth
    if (!data?.session || !data?.user?.email) {
      return NextResponse.json({
        authorized: false,
        authenticated: false,
        reason: "not_authenticated"
      })
    }

    const email = data.user.email

    // Check if user has access (exists in dashboard_users or has valid invite)
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
