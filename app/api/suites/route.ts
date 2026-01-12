import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"
import type { TechStack, UpdateSuiteRequest } from "@/lib/types"

export const dynamic = "force-dynamic"

/**
 * GET /api/suites
 *
 * List all suites with aggregated statistics
 * Query params:
 *   - tech_stack: Filter by tech stack (playwright, cypress, vitest, etc.)
 *   - active: Filter by active status (true/false)
 */
export async function GET(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = getQueriesForOrg(context.organizationId)

    const { searchParams } = new URL(request.url)
    const techStack = searchParams.get("tech_stack") as TechStack | null
    const activeParam = searchParams.get("active")
    const isActive =
      activeParam === "true" ? true : activeParam === "false" ? false : undefined

    // Get suites with stats using the options
    const suites = await db.getSuiteRegistry({
      techStack: techStack || undefined,
      isActive,
    })

    // Also get summary stats
    const summary = await db.getSuiteCountsSummary()

    return NextResponse.json({
      suites,
      summary,
    })
  } catch (error) {
    console.error("[GET /api/suites] Error:", error)
    return NextResponse.json({ error: "Failed to fetch suites" }, { status: 500 })
  }
}

/**
 * PATCH /api/suites
 *
 * Update suite metadata
 * Request body:
 * {
 *   suiteId: number,
 *   description?: string,
 *   repository_url?: string,
 *   tech_stack?: TechStack,
 *   is_active?: boolean
 * }
 */
export async function PATCH(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { suiteId, ...updates } = body as { suiteId: number } & UpdateSuiteRequest

    if (!suiteId || typeof suiteId !== "number") {
      return NextResponse.json({ error: "suiteId is required" }, { status: 400 })
    }

    const db = getQueriesForOrg(context.organizationId)

    // Verify suite exists and belongs to org
    const suite = await db.getSuiteById(suiteId)
    if (!suite) {
      return NextResponse.json({ error: "Suite not found" }, { status: 404 })
    }

    await db.updateSuite(suiteId, updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[PATCH /api/suites] Error:", error)
    return NextResponse.json({ error: "Failed to update suite" }, { status: 500 })
  }
}
