import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and owners can trigger baseline updates
    if (context.orgRole !== "admin" && context.orgRole !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const db = getQueriesForOrg(context.organizationId)
    const updatedCount = await db.updatePerformanceBaselines()

    return NextResponse.json({
      success: true,
      message: "Baselines updated",
      updatedCount,
    })
  } catch (error) {
    console.error("[API] Error updating baselines:", error)
    return NextResponse.json(
      { error: "Failed to update baselines" },
      { status: 500 }
    )
  }
}
