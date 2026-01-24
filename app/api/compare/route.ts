import { NextResponse } from "next/server"
import { getSessionContext } from "@/lib/session-context"
import { getQueriesForOrg } from "@/lib/db"
import type { TestDiffCategory } from "@/lib/types"

export const dynamic = "force-dynamic"

/**
 * Compare two test executions
 *
 * Query params:
 * - baseline: Baseline execution ID
 * - current: Current execution ID
 * - baseline_branch: Use latest execution from this branch as baseline
 * - current_branch: Use latest execution from this branch as current
 * - suite: Filter to specific suite (applies to branch lookups)
 * - filter: Filter results by diff category (new_failure, fixed, new_test, removed_test, all)
 */
export async function GET(request: Request) {
  try {
    const context = await getSessionContext()
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const baselineId = searchParams.get("baseline")
    const currentId = searchParams.get("current")
    const baselineBranch = searchParams.get("baseline_branch")
    const currentBranch = searchParams.get("current_branch")
    const suite = searchParams.get("suite") || undefined
    const filter = searchParams.get("filter") as TestDiffCategory | "performance_regression" | "all" | null
    const performanceThreshold = searchParams.get("performance_threshold")
      ? parseInt(searchParams.get("performance_threshold")!, 10)
      : 20

    const db = getQueriesForOrg(context.organizationId)

    // Resolve execution IDs (either from direct IDs or from branch names)
    let resolvedBaselineId: number | null = baselineId ? parseInt(baselineId, 10) : null
    let resolvedCurrentId: number | null = currentId ? parseInt(currentId, 10) : null

    // PERFORMANCE OPTIMIZATION: Parallelize branch lookups instead of sequential
    // Expected improvement: ~50% faster for branch-based comparisons
    if ((baselineBranch && !resolvedBaselineId) || (currentBranch && !resolvedCurrentId)) {
      const [baselineExecution, currentExecution] = await Promise.all([
        baselineBranch && !resolvedBaselineId
          ? db.getLatestExecutionByBranch(baselineBranch, suite)
          : null,
        currentBranch && !resolvedCurrentId
          ? db.getLatestExecutionByBranch(currentBranch, suite)
          : null,
      ])

      if (baselineBranch && !resolvedBaselineId) {
        if (!baselineExecution) {
          return NextResponse.json(
            { error: `No execution found for baseline branch: ${baselineBranch}` },
            { status: 404 }
          )
        }
        resolvedBaselineId = baselineExecution.id
      }

      if (currentBranch && !resolvedCurrentId) {
        if (!currentExecution) {
          return NextResponse.json(
            { error: `No execution found for current branch: ${currentBranch}` },
            { status: 404 }
          )
        }
        resolvedCurrentId = currentExecution.id
      }
    }

    // Validate we have both IDs
    if (!resolvedBaselineId || !resolvedCurrentId) {
      return NextResponse.json(
        {
          error: "Both baseline and current execution IDs are required. Provide 'baseline' and 'current' params, or 'baseline_branch' and 'current_branch' params.",
        },
        { status: 400 }
      )
    }

    // Prevent comparing same execution
    if (resolvedBaselineId === resolvedCurrentId) {
      return NextResponse.json(
        { error: "Cannot compare an execution with itself" },
        { status: 400 }
      )
    }

    // Get comparison result with performance threshold
    const comparison = await db.compareExecutions(resolvedBaselineId, resolvedCurrentId, {
      performanceThreshold,
    })

    // Calculate performance summary
    const performanceSummary = {
      regressions: comparison.tests.filter((t) => t.durationCategory === "regression").length,
      improvements: comparison.tests.filter((t) => t.durationCategory === "improvement").length,
      stable: comparison.tests.filter((t) => t.durationCategory === "stable").length,
      threshold_pct: performanceThreshold,
    }

    // Apply filter if specified
    if (filter === "performance_regression") {
      comparison.tests = comparison.tests.filter((t) => t.durationCategory === "regression")
    } else if (filter && filter !== "all") {
      comparison.tests = comparison.tests.filter((t) => t.diffCategory === filter)
    }

    return NextResponse.json({
      ...comparison,
      performanceSummary,
    })
  } catch (error) {
    console.error("[API] Error comparing executions:", error)
    
    // Provide more specific error messages
    let message = "Failed to compare executions"
    let details: string | undefined
    
    if (error instanceof Error) {
      message = error.message
      
      // Add context for common database errors
      if (message.includes("operator is not unique")) {
        message = "Database type error in comparison query"
        details = "A SQL operator could not resolve type ambiguity. This is a bug - please report it."
      } else if (message.includes("not found")) {
        // Execution not found errors are already clear
      } else if (message.includes("connection")) {
        message = "Database connection error"
        details = "Could not connect to the database. Please try again later."
      }
    }
    
    return NextResponse.json(
      { 
        error: message, 
        details,
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    )
  }
}
