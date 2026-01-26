/**
 * API Route: /api/relevance
 * Manage test relevance scores
 */

import { NextRequest, NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import {
  getAllRelevanceScores,
  getTestsNeedingLabels,
  getCriticalTests,
  setRelevanceOverride,
  batchSetRelevanceOverride,
  removeRelevanceOverride,
  getRelevanceStats,
  labelToScore,
  type RelevanceLabel,
} from "@/lib/db"
import { calculateRelevanceScores } from "@/lib/services/relevance-scoring-service"

export const dynamic = "force-dynamic"

/**
 * GET /api/relevance
 * Get relevance scores with various filters
 *
 * Query params:
 * - view: "all" | "needing_labels" | "critical" | "stats"
 * - limit: number (default 50)
 * - offset: number (default 0)
 * - minScore: number (default 0)
 * - label: "critical" | "high" | "medium" | "low" | "ignore"
 * - sortBy: "score" | "name" | "updated"
 * - sortOrder: "asc" | "desc"
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const view = searchParams.get("view") || "all"
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)
    const minScore = parseInt(searchParams.get("minScore") || "0", 10)
    const label = searchParams.get("label") as RelevanceLabel | null
    const sortBy = searchParams.get("sortBy") as "score" | "name" | "updated" | null
    const sortOrder = searchParams.get("sortOrder") as "asc" | "desc" | null

    switch (view) {
      case "stats":
        const stats = await getRelevanceStats(context.organizationId)
        return NextResponse.json({ data: stats })

      case "needing_labels":
        const needingLabels = await getTestsNeedingLabels(context.organizationId, limit)
        return NextResponse.json({
          data: needingLabels,
          pagination: { limit, count: needingLabels.length },
        })

      case "critical":
        const critical = await getCriticalTests(context.organizationId, limit)
        return NextResponse.json({
          data: critical,
          pagination: { limit, count: critical.length },
        })

      case "all":
      default:
        const scores = await getAllRelevanceScores(context.organizationId, {
          limit,
          offset,
          minScore,
          label: label || undefined,
          sortBy: sortBy || undefined,
          sortOrder: sortOrder || undefined,
        })
        return NextResponse.json({
          data: scores,
          pagination: { limit, offset, count: scores.length, hasMore: scores.length === limit },
        })
    }
  } catch (error) {
    console.error("[api/relevance] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch relevance scores" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/relevance
 * Set or update relevance override for a test
 *
 * Body:
 * - testSignature: string (required)
 * - label: "critical" | "high" | "medium" | "low" | "ignore" (required)
 * - reason: string (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only org admins/owners can set relevance
    if (context.orgRole !== "owner" && context.orgRole !== "admin") {
      return NextResponse.json(
        { error: "Only organization admins can modify relevance scores" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { testSignature, label, reason } = body

    if (!testSignature || !label) {
      return NextResponse.json(
        { error: "testSignature and label are required" },
        { status: 400 }
      )
    }

    const validLabels: RelevanceLabel[] = ["critical", "high", "medium", "low", "ignore"]
    if (!validLabels.includes(label)) {
      return NextResponse.json(
        { error: `Invalid label. Must be one of: ${validLabels.join(", ")}` },
        { status: 400 }
      )
    }

    const score = labelToScore(label)
    const result = await setRelevanceOverride(
      context.organizationId,
      testSignature,
      score,
      label,
      reason || null,
      context.userId
    )

    if (!result) {
      return NextResponse.json(
        { error: "Test not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error("[api/relevance] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to set relevance override" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/relevance
 * Batch update relevance scores
 *
 * Body:
 * - updates: Array<{ testSignature: string, label: RelevanceLabel, reason?: string }>
 */
export async function PUT(request: NextRequest) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only org admins/owners can set relevance
    if (context.orgRole !== "owner" && context.orgRole !== "admin") {
      return NextResponse.json(
        { error: "Only organization admins can modify relevance scores" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { updates } = body

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "updates array is required" },
        { status: 400 }
      )
    }

    // Validate all updates
    const validLabels: RelevanceLabel[] = ["critical", "high", "medium", "low", "ignore"]
    for (const update of updates) {
      if (!update.testSignature || !update.label) {
        return NextResponse.json(
          { error: "Each update must have testSignature and label" },
          { status: 400 }
        )
      }
      if (!validLabels.includes(update.label)) {
        return NextResponse.json(
          { error: `Invalid label "${update.label}". Must be one of: ${validLabels.join(", ")}` },
          { status: 400 }
        )
      }
    }

    const result = await batchSetRelevanceOverride(
      context.organizationId,
      updates,
      context.userId
    )

    return NextResponse.json({
      success: true,
      updated: result.updated,
      failed: result.failed,
    })
  } catch (error) {
    console.error("[api/relevance] PUT error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to batch update relevance" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/relevance
 * Remove relevance override (revert to auto-calculated)
 *
 * Query params:
 * - testSignature: string (required)
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only org admins/owners can remove overrides
    if (context.orgRole !== "owner" && context.orgRole !== "admin") {
      return NextResponse.json(
        { error: "Only organization admins can modify relevance scores" },
        { status: 403 }
      )
    }

    const testSignature = request.nextUrl.searchParams.get("testSignature")
    if (!testSignature) {
      return NextResponse.json(
        { error: "testSignature is required" },
        { status: 400 }
      )
    }

    const success = await removeRelevanceOverride(context.organizationId, testSignature)

    return NextResponse.json({
      success,
      message: success ? "Override removed" : "No override found to remove",
    })
  } catch (error) {
    console.error("[api/relevance] DELETE error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove relevance override" },
      { status: 500 }
    )
  }
}
