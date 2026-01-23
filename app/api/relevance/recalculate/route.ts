/**
 * API Route: /api/relevance/recalculate
 * Trigger full recalculation of relevance scores
 */

import { NextRequest, NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { calculateRelevanceScores } from "@/lib/services/relevance-scoring-service"

export const dynamic = "force-dynamic"

/**
 * POST /api/relevance/recalculate
 * Trigger full recalculation of all relevance scores
 * Only org admins can trigger this
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only org admins/owners can trigger recalculation
    if (context.orgRole !== "owner" && context.orgRole !== "admin") {
      return NextResponse.json(
        { error: "Only organization admins can trigger recalculation" },
        { status: 403 }
      )
    }

    const startTime = Date.now()
    const results = await calculateRelevanceScores(context.organizationId, {
      forceRecalculate: true,
    })
    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      testsUpdated: results.length,
      durationMs: duration,
    })
  } catch (error) {
    console.error("[api/relevance/recalculate] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to recalculate scores" },
      { status: 500 }
    )
  }
}
