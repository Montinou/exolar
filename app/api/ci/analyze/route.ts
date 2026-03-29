import { NextResponse } from "next/server"
import { validateOrgApiKey, isExolarApiKey } from "@/lib/api-keys"
import { getSessionContext } from "@/lib/session-context"
import { analyzeExecution } from "@/lib/ci/analysis-engine"
import { getSql } from "@/lib/db/connection"
import type { AnalysisResult } from "@/lib/ci/analysis-engine"

export const dynamic = "force-dynamic"

/**
 * POST /api/ci/analyze
 *
 * Triggers CI failure analysis for a test execution.
 * Supports two authentication methods:
 *   1. Organization API key (exolar_...) via Bearer token
 *   2. Session authentication (browser/dashboard)
 *
 * Request body:
 * {
 *   execution_id?: number,
 *   run_id?: string
 * }
 *
 * Response: AnalysisResult from analysis-engine
 */
export async function POST(request: Request): Promise<NextResponse<AnalysisResult | { error: string }>> {
  // 1. Auth: try org API key first, fall back to session
  const authHeader = request.headers.get("authorization")
  let organizationId: number

  if (isExolarApiKey(authHeader)) {
    const validatedKey = await validateOrgApiKey(authHeader)
    if (!validatedKey) {
      return NextResponse.json({ error: "Invalid or expired API key" }, { status: 401 })
    }
    organizationId = validatedKey.organizationId
  } else {
    const session = await getSessionContext()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    organizationId = session.organizationId
  }

  // 2. Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
  }

  const { execution_id, run_id } = (body ?? {}) as { execution_id?: unknown; run_id?: unknown }

  if (execution_id == null && (run_id == null || run_id === "")) {
    return NextResponse.json({ error: "Either execution_id or run_id is required" }, { status: 400 })
  }

  let executionId: number

  try {
    const sql = getSql()

    // 3. Resolve execution_id from run_id if needed
    if (execution_id != null) {
      executionId = Number(execution_id)
      if (!Number.isInteger(executionId) || executionId <= 0) {
        return NextResponse.json({ error: "execution_id must be a positive integer" }, { status: 400 })
      }
    } else {
      const rows = await sql.unsafe(
        `SELECT id FROM test_executions WHERE run_id = $1 AND organization_id = $2 LIMIT 1`,
        [String(run_id), organizationId]
      )
      if (!rows || rows.length === 0) {
        return NextResponse.json({ error: "Execution not found" }, { status: 404 })
      }
      executionId = Number((rows as Array<Record<string, unknown>>)[0].id)
    }

    // 4. Run analysis
    const result = await analyzeExecution(executionId, organizationId)

    // 5. Persist result to ci_analysis_results
    const actionPlanJson = JSON.stringify(result.action_plan)
    await sql.unsafe(
      `INSERT INTO ci_analysis_results (
        organization_id,
        execution_id,
        action_plan,
        total_failures,
        healable_count,
        bug_count,
        known_flake_count,
        infra_count,
        manual_review_count,
        overall_confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (execution_id) DO UPDATE SET
        action_plan = EXCLUDED.action_plan,
        total_failures = EXCLUDED.total_failures,
        healable_count = EXCLUDED.healable_count,
        bug_count = EXCLUDED.bug_count,
        known_flake_count = EXCLUDED.known_flake_count,
        infra_count = EXCLUDED.infra_count,
        manual_review_count = EXCLUDED.manual_review_count,
        overall_confidence = EXCLUDED.overall_confidence`,
      [
        organizationId,
        executionId,
        actionPlanJson,
        result.total_failures,
        result.action_plan.healable.length,
        result.action_plan.bugs.length,
        result.action_plan.known_flakes.length,
        result.action_plan.infra_issues.length,
        result.action_plan.manual_review.length,
        result.confidence,
      ]
    )

    // 6. Return analysis result
    return NextResponse.json(result)
  } catch (error) {
    console.error("[POST /api/ci/analyze] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
