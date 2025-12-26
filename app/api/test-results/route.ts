import { NextResponse } from "next/server"
import { validateApiKey } from "@/lib/auth"
import { validateIngestRequest } from "@/lib/validation"
import { insertExecution, insertTestResults, insertArtifacts } from "@/lib/db"
import type { IngestResponse } from "@/lib/types"

export const dynamic = "force-dynamic"

/**
 * POST /api/test-results
 *
 * Receives test execution data from Playwright custom reporter.
 * Requires Bearer token authentication via DASHBOARD_API_KEY.
 *
 * Request body:
 * {
 *   execution: ExecutionRequest,
 *   results: TestResultRequest[],
 *   artifacts?: ArtifactRequest[]
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   execution_id?: number,
 *   results_count?: number,
 *   artifacts_count?: number,
 *   error?: string
 * }
 */
export async function POST(request: Request): Promise<NextResponse<IngestResponse>> {
  // 1. Validate API key
  const authHeader = request.headers.get("authorization")
  if (!validateApiKey(authHeader)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    )
  }

  // 2. Parse request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON in request body" },
      { status: 400 }
    )
  }

  // 3. Validate request schema
  const validation = validateIngestRequest(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error },
      { status: 400 }
    )
  }

  const { execution, results, artifacts } = validation.data

  try {
    // 4. Insert execution record
    const executionId = await insertExecution(execution)

    // 5. Insert test results
    const signatureToIdMap = await insertTestResults(executionId, results)

    // 6. Insert artifacts (if any)
    let artifactsCount = 0
    if (artifacts && artifacts.length > 0) {
      artifactsCount = await insertArtifacts(signatureToIdMap, artifacts)
    }

    // 7. Return success response
    return NextResponse.json({
      success: true,
      execution_id: executionId,
      results_count: results.length,
      artifacts_count: artifactsCount,
    })
  } catch (error) {
    // Log the full error for debugging
    console.error("[POST /api/test-results] Database error:", error)

    // Return generic error to client
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
