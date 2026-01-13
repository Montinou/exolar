import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getTopPatterns } from "@/lib/db/patterns"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("days") || "30", 10)
    const limit = parseInt(searchParams.get("limit") || "10", 10)

    const patterns = await getTopPatterns(context.organizationId, days, limit)

    return NextResponse.json({
      patterns: patterns.map((p) => ({
        id: p.id,
        canonicalError: p.canonicalError,
        category: p.category,
        totalOccurrences: p.totalOccurrences,
        affectedExecutions: p.affectedExecutions,
        affectedTests: p.affectedTests,
        firstSeen: p.firstSeen.toISOString(),
        lastSeen: p.lastSeen.toISOString(),
      })),
    })
  } catch (error) {
    console.error("Failed to fetch top patterns:", error)
    return NextResponse.json(
      { error: "Failed to fetch top patterns" },
      { status: 500 }
    )
  }
}
