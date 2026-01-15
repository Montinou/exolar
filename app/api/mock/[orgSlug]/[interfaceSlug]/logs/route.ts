import { NextRequest, NextResponse } from "next/server"
import { getPublicMockLogs } from "@/lib/db/mocks"

export const dynamic = "force-dynamic"

/**
 * Public endpoint to access mock request logs.
 * No authentication required - accessible if slugs are known.
 *
 * GET /api/mock/{org-slug}/{interface-slug}/logs
 *
 * Query params:
 *   - since: ISO8601 timestamp (default: last 5 minutes)
 *   - limit: Max entries 1-500 (default: 50)
 *   - path: Filter by path (partial match)
 *   - method: Filter by HTTP method (GET, POST, etc.)
 *
 * Example:
 *   GET /api/mock/my-org/webhook-api/logs?since=2024-01-15T10:00:00Z&limit=10&path=/webhook
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string; interfaceSlug: string }> }
) {
  try {
    const { orgSlug, interfaceSlug } = await context.params
    const { searchParams } = new URL(request.url)

    // Parse query params
    const since = searchParams.get("since") || undefined
    const limitParam = searchParams.get("limit")
    const limit = limitParam ? parseInt(limitParam, 10) : undefined
    const path = searchParams.get("path") || undefined
    const method = searchParams.get("method") || undefined

    const result = await getPublicMockLogs(orgSlug, interfaceSlug, {
      since,
      limit,
      path,
      method,
    })

    // Interface not found or inactive
    if (!result.interface) {
      return NextResponse.json(
        { error: "Mock interface not found or inactive" },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[Public Mock Logs] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
