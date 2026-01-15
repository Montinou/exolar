import { NextResponse } from "next/server"
import { requireSuperadmin } from "@/lib/session-context"
import { getAllOrganizations } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/organizations - List all organizations (superadmin only)
 * Regular admins cannot access this endpoint - they can only manage their own org
 */
export async function GET() {
  try {
    await requireSuperadmin()

    const organizations = await getAllOrganizations()
    return NextResponse.json({ organizations })
  } catch (error) {
    if (error instanceof Error && error.message === "Superadmin access required") {
      return NextResponse.json({ error: "Superadmin access required" }, { status: 403 })
    }
    console.error("Error fetching organizations:", error)
    return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 })
  }
}
