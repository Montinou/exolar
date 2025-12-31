import { NextResponse } from "next/server"
import { requireSystemAdmin } from "@/lib/session-context"
import { getAllOrganizations } from "@/lib/db-orgs"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/organizations - List all organizations (system admin only)
 */
export async function GET() {
  try {
    await requireSystemAdmin()

    const organizations = await getAllOrganizations()
    return NextResponse.json({ organizations })
  } catch (error) {
    if (error instanceof Error && error.message === "System admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("Error fetching organizations:", error)
    return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 })
  }
}
