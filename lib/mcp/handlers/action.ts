/**
 * Handler: perform_exolar_action
 *
 * Acciones pesadas y mutaciones que no son queries simples.
 * Reemplaza: compare_executions, generate_failure_report, classify_failure
 */

import { z } from "zod"
import type { MCPAuthContext } from "../auth"
import * as db from "@/lib/db"

const ActionInputSchema = z.object({
  action: z.enum([
    "compare",
    "generate_report",
    "classify",
    "find_similar",
    "reembed",
    "create_mock_interface",
    "create_mock_route",
    "create_mock_rule",
    "delete_mock_interface",
  ]),
  params: z
    .object({
      // Para compare
      baseline_id: z.number().optional(),
      current_id: z.number().optional(),
      baseline_branch: z.string().optional(),
      current_branch: z.string().optional(),
      suite: z.string().optional(),
      filter: z
        .enum(["new_failure", "fixed", "new_test", "removed_test", "performance_regression", "all"])
        .optional(),
      performance_threshold: z.number().min(1).max(100).optional(),

      // Para generate_report
      execution_id: z.number().optional(),
      include_passed: z.boolean().optional(),
      include_recommendations: z.boolean().optional(),

      // Para classify
      test_id: z.number().optional(),
      test_name: z.string().optional(),
      test_file: z.string().optional(),

      // Para find_similar (Phase 8: AI Vector Search)
      test_result_id: z.number().optional(),
      scope: z.enum(["current", "historical"]).optional(), // current = same execution, historical = across org
      threshold: z.number().min(0).max(1).optional(), // Similarity threshold (0-1)
      rerank: z.boolean().optional(), // Enable Cohere reranking
      limit: z.number().optional(), // Limit for find_similar

      // Para reembed
      type: z.enum(["error", "test", "suite", "clear"]).optional(), // error=failures only, test=all tests, suite=executions, clear=remove old embeddings
      version: z.enum(["v1", "v2", "both"]).optional(),
      force: z.boolean().optional(),
      dry_run: z.boolean().optional(),

      // Para mock_interface
      name: z.string().optional(),
      slug: z.string().optional(),
      description: z.string().optional(),
      rate_limit_rpm: z.number().optional(),
      interface_id: z.number().optional(),

      // Para mock_route
      path_pattern: z.string().optional(),
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "*"]).optional(),
      route_id: z.number().optional(),
      priority: z.number().optional(),

      // Para mock_rule
      match_headers: z.record(z.string()).optional(),
      match_query: z.record(z.string()).optional(),
      match_body: z.record(z.unknown()).optional(),
      match_body_contains: z.string().optional(),
      response_status: z.number().optional(),
      response_headers: z.record(z.string()).optional(),
      response_body: z.string().optional(),
      response_delay_ms: z.number().optional(),
    })
    .optional()
    .default({}),
  format: z.enum(["json", "markdown"]).optional().default("markdown"),
})

export type ActionInput = z.infer<typeof ActionInputSchema>

interface ToolResponse {
  content: Array<{ type: "text"; text: string }>
  isError?: boolean
}

export async function handleAction(
  args: Record<string, unknown>,
  authContext: MCPAuthContext
): Promise<ToolResponse> {
  const input = ActionInputSchema.parse(args)
  const orgId = authContext.organizationId
  const p = input.params

  try {
    switch (input.action) {
      // ============================================
      // Compare Executions
      // ============================================
      case "compare": {
        // Resolve execution IDs
        let baselineId = p.baseline_id
        let currentId = p.current_id

        // Resolve branch to execution ID if branch specified
        if (p.baseline_branch && !baselineId) {
          const baselineExec = await db.getLatestExecutionByBranch(orgId, p.baseline_branch, p.suite)
          if (!baselineExec) {
            // Get available branches for suggestion
            const branches = await db.getBranches(orgId, 30)
            const branchList = branches.slice(0, 5).map(b => b.branch).join(", ")
            const suffix = branches.length > 5 ? `, ... (${branches.length} total)` : ""
            return errorResponse(
              `No execution found for branch "${p.baseline_branch}"${p.suite ? ` with suite "${p.suite}"` : ""}. ` +
              `Available branches: ${branchList || "none"}${suffix}`
            )
          }
          baselineId = baselineExec.id
        }

        if (p.current_branch && !currentId) {
          const currentExec = await db.getLatestExecutionByBranch(orgId, p.current_branch, p.suite)
          if (!currentExec) {
            // Get available branches for suggestion
            const branches = await db.getBranches(orgId, 30)
            const branchList = branches.slice(0, 5).map(b => b.branch).join(", ")
            const suffix = branches.length > 5 ? `, ... (${branches.length} total)` : ""
            return errorResponse(
              `No execution found for branch "${p.current_branch}"${p.suite ? ` with suite "${p.suite}"` : ""}. ` +
              `Available branches: ${branchList || "none"}${suffix}`
            )
          }
          currentId = currentExec.id
        }

        // Validate we have both IDs
        if (!baselineId || !currentId) {
          return errorResponse(
            "Must provide either baseline_id/current_id or baseline_branch/current_branch"
          )
        }

        // Get comparison with performance threshold
        const comparison = await db.compareExecutions(orgId, baselineId, currentId, {
          performanceThreshold: p.performance_threshold ?? 20,
        })

        if (!comparison) {
          return errorResponse("One or both executions not found or access denied")
        }

        // Calculate performance summary
        const performanceSummary = {
          regressions: comparison.tests.filter((t) => t.durationCategory === "regression").length,
          improvements: comparison.tests.filter((t) => t.durationCategory === "improvement").length,
          stable: comparison.tests.filter((t) => t.durationCategory === "stable").length,
          threshold_pct: p.performance_threshold ?? 20,
        }

        // Apply filter if specified
        let filteredTests = comparison.tests
        if (p.filter === "performance_regression") {
          filteredTests = comparison.tests.filter((t) => t.durationCategory === "regression")
        } else if (p.filter && p.filter !== "all") {
          filteredTests = comparison.tests.filter((t) => t.diffCategory === p.filter)
        }

        if (input.format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            action: "compare",
            baseline: comparison.baseline,
            current: comparison.current,
            summary: comparison.summary,
            performanceSummary,
            filter: p.filter || "all",
            tests: filteredTests,
            test_count: filteredTests.length,
          })
        }

        // Markdown format
        let output = `## Execution Comparison\n\n`
        output += `| | Baseline | Current |\n`
        output += `|---|----------|----------|\n`
        output += `| ID | ${comparison.baseline.id} | ${comparison.current.id} |\n`
        output += `| Branch | ${comparison.baseline.branch} | ${comparison.current.branch} |\n`
        output += `| Passed | ${comparison.baseline.passed} | ${comparison.current.passed} |\n`
        output += `| Failed | ${comparison.baseline.failed} | ${comparison.current.failed} |\n\n`

        output += `### Summary\n`
        output += `- New Failures: ${comparison.summary.newFailures}\n`
        output += `- Fixed: ${comparison.summary.fixed}\n`
        output += `- New Tests: ${comparison.summary.newTests}\n`
        output += `- Removed Tests: ${comparison.summary.removedTests}\n`
        output += `- Performance Regressions: ${performanceSummary.regressions}\n`
        output += `- Performance Improvements: ${performanceSummary.improvements}\n`

        if (filteredTests.length > 0 && p.filter && p.filter !== "all") {
          output += `\n### ${p.filter.replace(/_/g, " ").toUpperCase()} (${filteredTests.length})\n\n`
          for (const t of filteredTests.slice(0, 10)) {
            output += `- ${t.testName}: ${t.diffCategory}\n`
          }
          if (filteredTests.length > 10) {
            output += `\n_...and ${filteredTests.length - 10} more_\n`
          }
        }

        return textResponse(output)
      }

      // ============================================
      // Generate Failure Report
      // ============================================
      case "generate_report": {
        if (!p.execution_id) {
          return errorResponse("generate_report requires params.execution_id")
        }

        const summary = await db.getExecutionSummary(orgId, p.execution_id)

        if (!summary) {
          return errorResponse("Execution not found or access denied")
        }

        const failures = await db.getFailedTestsByExecutionId(orgId, p.execution_id, {
          includeRetries: false,
          includeStackTraces: false,
        })

        // Group failures by file
        const failuresByFile: Record<string, typeof failures> = {}
        for (const f of failures) {
          if (!failuresByFile[f.test_file]) failuresByFile[f.test_file] = []
          failuresByFile[f.test_file].push(f)
        }

        // Generate markdown report
        const { execution, summary: stats, error_distribution } = summary
        let report = `# Test Execution Report

**Execution ID:** ${execution.id}
**Branch:** \`${execution.branch}\`
**Commit:** \`${execution.commit_sha?.substring(0, 8) || "N/A"}\`
**Date:** ${execution.started_at}
**Duration:** ${Math.round((stats.duration_ms || 0) / 1000)}s

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tests** | ${stats.total} |
| **Passed** | ${stats.passed} |
| **Failed** | ${stats.failed} |
| **Skipped** | ${stats.skipped} |
| **Pass Rate** | ${stats.pass_rate}% |

---

## Error Distribution

| Error Type | Count |
|------------|-------|
${error_distribution.map((e) => `| ${e.error_pattern} | ${e.count} |`).join("\n")}

---

## Failed Tests by File

`
        for (const [file, tests] of Object.entries(failuresByFile)) {
          report += `### ${file}\n\n`
          report += `| Test Name | Error | Duration |\n`
          report += `|-----------|-------|----------|\n`
          for (const t of tests) {
            const errorShort = (t.error_message || "Unknown").substring(0, 60).replace(/\|/g, "\\|")
            report += `| ${t.test_name} | ${errorShort}... | ${t.duration_ms}ms |\n`
          }
          report += `\n`
        }

        if ((p.include_recommendations ?? true) && stats.failed > 0) {
          report += `---

## Recommendations

`
          // Analyze errors and generate recommendations
          const hasApiErrors = error_distribution.some((e) => e.error_pattern.includes("API Error"))
          const hasTimeouts = error_distribution.some((e) => e.error_pattern.includes("Timeout"))

          if (hasApiErrors) {
            report += `1. **Investigate Backend API Issues**
   - Check API logs for 500 errors
   - Verify database connectivity
   - Check environment variables on preview deployment

`
          }

          if (hasTimeouts) {
            report += `2. **Fix Timeout Issues**
   - Review modal close handlers
   - Check for race conditions in async operations
   - Consider increasing timeouts or adding explicit waits

`
          }

          if (!hasApiErrors && !hasTimeouts) {
            report += `1. **Review Test Assertions**
   - Check if selectors are up to date
   - Verify test data setup

`
          }
        }

        if (input.format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            action: "generate_report",
            execution_id: p.execution_id,
            format: "markdown",
            report,
          })
        }

        return textResponse(report)
      }

      // ============================================
      // Classify Failure
      // ============================================
      case "classify": {
        // Must have either test_id OR (execution_id + test_name)
        if (!p.test_id && (!p.execution_id || !p.test_name)) {
          return errorResponse("classify requires either test_id OR (execution_id + test_name)")
        }

        const classification = await db.getFailureClassification(orgId, {
          testId: p.test_id,
          executionId: p.execution_id,
          testName: p.test_name,
          testFile: p.test_file,
        })

        if (!classification) {
          return errorResponse("Test not found or no failure data available")
        }

        if (input.format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            action: "classify",
            ...classification,
          })
        }

        // Markdown format
        let output = `## Failure Classification\n\n`
        output += `**Test:** ${classification.test_id}\n`
        output += `**Classification:** ${classification.suggested_classification}\n`
        output += `**Confidence:** ${(classification.confidence * 100).toFixed(0)}%\n\n`

        output += `### Reasoning\n`
        output += `${classification.reasoning}\n\n`

        if (classification.historical_metrics) {
          const hm = classification.historical_metrics
          const passRate = hm.total_runs > 0 ? ((hm.passed_runs / hm.total_runs) * 100).toFixed(1) : "0"
          output += `### Historical Metrics\n`
          output += `- Total Runs: ${hm.total_runs}\n`
          output += `- Pass Rate: ${passRate}%\n`
          output += `- Flaky Rate: ${hm.flakiness_rate?.toFixed(1) || 0}%\n`
        }

        return textResponse(output)
      }

      // ============================================
      // Find Similar Failures (Phase 8: AI Vector Search)
      // ============================================
      case "find_similar": {
        if (!p.test_result_id) {
          return errorResponse("find_similar requires params.test_result_id")
        }

        // Get the best available embedding for this test result
        const embeddingData = await db.getBestEmbedding(p.test_result_id)
        if (!embeddingData) {
          return errorResponse("Test result not found or no embedding available")
        }

        const { embedding, version } = embeddingData
        const scope = p.scope || "historical"
        const threshold = p.threshold ?? 0.15

        // Find similar failures
        let similarFailures: Array<{
          id: number
          test_name: string
          test_file: string
          error_message: string | null
          execution_id: number
          branch: string
          suite: string | null
          similarity: number
          created_at: string
        }> = []

        if (scope === "current") {
          // Get execution_id for this test_result
          const sql = db.getSql()
          const testResult = await sql`
            SELECT execution_id FROM test_results WHERE id = ${p.test_result_id}
          `.then((rows) => rows[0] as { execution_id: number } | undefined)

          if (!testResult) {
            return errorResponse("Test result not found")
          }

          // Find similar in same execution
          if (version === "v2") {
            similarFailures = await db.findSimilarFailuresV2(embedding, {
              organizationId: orgId,
              executionId: testResult.execution_id,
              threshold,
              limit: p.limit ?? 20,
            })
          } else {
            similarFailures = await db.findSimilarFailures(embedding, {
              organizationId: orgId,
              executionId: testResult.execution_id,
              threshold,
              limit: p.limit ?? 20,
            })
          }
        } else {
          // Historical search across org
          similarFailures = await db.findHistoricalClusters(embedding, orgId, {
            threshold,
            limit: p.limit ?? 20,
            daysBack: 30,
          })
        }

        // Optional: Apply reranking if requested
        if (p.rerank && similarFailures.length > 0) {
          try {
            const { rerankItems, isRerankingAvailable } = await import("@/lib/ai/reranker")
            if (isRerankingAvailable()) {
              // Get original test error for query
              const sql = db.getSql()
              const originalTest = await sql`
                SELECT test_name, test_file, error_message
                FROM test_results
                WHERE id = ${p.test_result_id}
              `.then((rows) => rows[0] as { test_name: string; test_file: string; error_message: string | null } | undefined)

              if (originalTest) {
                const query = `${originalTest.test_name}\n${originalTest.test_file}\n${originalTest.error_message || ""}`
                similarFailures = await rerankItems(
                  query,
                  similarFailures,
                  (f) => `${f.test_name}\n${f.test_file}\n${f.error_message || ""}`,
                  {
                    topN: p.limit ?? 20,
                    minScore: 0.1,
                  }
                )
              }
            }
          } catch (error) {
            // Reranking failed, continue with vector results
            console.error("Reranking failed:", error)
          }
        }

        if (input.format === "json") {
          return jsonResponse({
            organization: authContext.organizationSlug,
            action: "find_similar",
            test_result_id: p.test_result_id,
            scope,
            threshold,
            embedding_version: version,
            reranked: p.rerank ?? false,
            total_similar: similarFailures.length,
            data: similarFailures,
          })
        }

        // Markdown format
        let output = `## Similar Failures\n\n`
        output += `**Test Result ID:** ${p.test_result_id}\n`
        output += `**Scope:** ${scope}\n`
        output += `**Threshold:** ${threshold}\n`
        output += `**Embedding Version:** ${version}\n`
        output += `**Found:** ${similarFailures.length} similar failures\n\n`

        if (similarFailures.length > 0) {
          output += "| Test | File | Branch | Similarity | Execution |\n"
          output += "|------|------|--------|------------|----------|\n"
          for (const f of similarFailures.slice(0, 15)) {
            const similarity = `${(f.similarity * 100).toFixed(0)}%`
            output += `| ${f.test_name.slice(0, 30)} | ${f.test_file.split("/").pop()?.slice(0, 20) || ""} | ${f.branch} | ${similarity} | #${f.execution_id} |\n`
          }

          if (similarFailures.length > 15) {
            output += `\n_...and ${similarFailures.length - 15} more similar failures_\n`
          }
        } else {
          output += "_No similar failures found with the current threshold_\n"
        }

        return textResponse(output)
      }

      // ============================================
      // Reembed Tests (error, test, suite, or clear)
      // ============================================
      case "reembed": {
        const embedType = p.type || "error"
        const force = p.force ?? false
        const limitCount = p.limit ?? 500
        const dryRun = p.dry_run ?? false
        const sql = db.getSql()

        // ---- CLEAR OLD EMBEDDINGS ----
        // Clears all test_embedding except the most recent N tests
        // Use: perform_exolar_action({ action: "reembed", params: { type: "clear", limit: 100 } })
        if (embedType === "clear") {
          const keepRecent = limitCount

          // Count how many will be cleared
          const countResult = await sql`
            WITH recent_tests AS (
              SELECT tr.id
              FROM test_results tr
              INNER JOIN test_executions te ON tr.execution_id = te.id
              WHERE te.organization_id = ${orgId}
              ORDER BY tr.created_at DESC
              LIMIT ${keepRecent}
            )
            SELECT
              COUNT(*) FILTER (WHERE tr.test_embedding IS NOT NULL AND tr.id NOT IN (SELECT id FROM recent_tests)) as to_clear,
              COUNT(*) FILTER (WHERE tr.test_embedding IS NOT NULL AND tr.id IN (SELECT id FROM recent_tests)) as to_keep,
              COUNT(*) FILTER (WHERE tr.test_embedding IS NOT NULL) as total_with_embedding
            FROM test_results tr
            INNER JOIN test_executions te ON tr.execution_id = te.id
            WHERE te.organization_id = ${orgId}
          ` as Array<{ to_clear: string; to_keep: string; total_with_embedding: string }>

          const toClear = Number(countResult[0].to_clear)
          const toKeep = Number(countResult[0].to_keep)
          const totalWithEmbedding = Number(countResult[0].total_with_embedding)

          if (dryRun) {
            return jsonResponse({
              organization: authContext.organizationSlug,
              action: "reembed",
              type: "clear",
              preview: {
                totalWithEmbedding,
                toClear,
                toKeep,
                keepRecent,
              },
            })
          }

          // Clear old embeddings
          await sql`
            WITH recent_tests AS (
              SELECT tr.id
              FROM test_results tr
              INNER JOIN test_executions te ON tr.execution_id = te.id
              WHERE te.organization_id = ${orgId}
              ORDER BY tr.created_at DESC
              LIMIT ${keepRecent}
            )
            UPDATE test_results
            SET test_embedding = NULL,
                test_embedding_hash = NULL
            WHERE id NOT IN (SELECT id FROM recent_tests)
              AND test_embedding IS NOT NULL
              AND id IN (
                SELECT tr.id FROM test_results tr
                INNER JOIN test_executions te ON tr.execution_id = te.id
                WHERE te.organization_id = ${orgId}
              )
          `

          return jsonResponse({
            organization: authContext.organizationSlug,
            action: "reembed",
            type: "clear",
            stats: {
              cleared: toClear,
              kept: toKeep,
              message: `Cleared ${toClear} old embeddings, kept ${toKeep} recent ones`,
            },
          })
        }

        // ---- SUITE EMBEDDINGS ----
        if (embedType === "suite") {
          const { generateSuiteEmbeddingsBatch, getSuiteEmbeddingConfig } = await import(
            "@/lib/services/suite-embedding-service"
          )

          // Get stats
          const statsResults = await sql`
            SELECT
              COUNT(*) as total,
              COUNT(suite_embedding) as with_embedding
            FROM test_executions
            WHERE organization_id = ${orgId}
          ` as Array<{ total: string; with_embedding: string }>
          const stats = statsResults[0]
          const toProcess = force ? Number(stats.total) : Number(stats.total) - Number(stats.with_embedding)

          if (dryRun) {
            return jsonResponse({
              organization: authContext.organizationSlug,
              action: "reembed",
              type: "suite",
              preview: {
                total: Number(stats.total),
                withEmbedding: Number(stats.with_embedding),
                toProcess: Math.min(toProcess, limitCount),
              },
            })
          }

          // Get executions to process
          const whereClause = force ? "" : "AND suite_embedding IS NULL"
          const executions = await sql`
            SELECT id, branch, suite, commit_message, total_tests, passed, failed, skipped, duration_ms, status
            FROM test_executions
            WHERE organization_id = ${orgId} ${sql.unsafe(whereClause)}
            ORDER BY started_at DESC
            LIMIT ${limitCount}
          ` as Array<{
            id: number
            branch: string | null
            suite: string | null
            commit_message: string | null
            total_tests: number | null
            passed: number | null
            failed: number | null
            skipped: number | null
            duration_ms: number | null
            status: string | null
          }>

          if (executions.length === 0) {
            return jsonResponse({
              organization: authContext.organizationSlug,
              action: "reembed",
              type: "suite",
              stats: { total: 0, succeeded: 0, failed: 0, message: "No executions to process" },
            })
          }

          const startTime = Date.now()
          const results = await generateSuiteEmbeddingsBatch(executions)
          const succeeded = results.filter((r) => r.success).length
          const failed = results.filter((r) => !r.success).length
          const config = getSuiteEmbeddingConfig()

          return jsonResponse({
            organization: authContext.organizationSlug,
            action: "reembed",
            type: "suite",
            stats: {
              total: executions.length,
              succeeded,
              failed,
              durationMs: Date.now() - startTime,
              provider: config.provider,
              dimensions: config.dimensions,
            },
          })
        }

        // ---- TEST EMBEDDINGS (all tests) ----
        if (embedType === "test") {
          const {
            generateEmbeddingsBatchWithProvider,
            getDefaultProvider,
            getDimensionsForProvider,
          } = await import("@/lib/ai")
          const { prepareTestForEmbedding, generateEmbeddingHash } = await import("@/lib/ai/sanitizer")

          // Get stats
          const statsResults = await sql`
            SELECT
              COUNT(*) as total,
              COUNT(test_embedding) as with_embedding
            FROM test_results tr
            INNER JOIN test_executions te ON tr.execution_id = te.id
            WHERE te.organization_id = ${orgId}
          ` as Array<{ total: string; with_embedding: string }>
          const stats = statsResults[0]
          const toProcess = force ? Number(stats.total) : Number(stats.total) - Number(stats.with_embedding)

          if (dryRun) {
            return jsonResponse({
              organization: authContext.organizationSlug,
              action: "reembed",
              type: "test",
              preview: {
                total: Number(stats.total),
                withEmbedding: Number(stats.with_embedding),
                toProcess: Math.min(toProcess, limitCount),
              },
            })
          }

          // Get tests to process
          const whereClause = force ? "" : "AND tr.test_embedding IS NULL"
          const tests = await sql`
            SELECT tr.id, tr.test_name, tr.test_file, tr.status, tr.duration_ms, tr.browser, tr.error_message
            FROM test_results tr
            INNER JOIN test_executions te ON tr.execution_id = te.id
            WHERE te.organization_id = ${orgId} ${sql.unsafe(whereClause)}
            ORDER BY tr.created_at DESC
            LIMIT ${limitCount}
          ` as Array<{
            id: number
            test_name: string
            test_file: string
            status: string
            duration_ms: number | null
            browser: string | null
            error_message: string | null
          }>

          if (tests.length === 0) {
            return jsonResponse({
              organization: authContext.organizationSlug,
              action: "reembed",
              type: "test",
              stats: { total: 0, succeeded: 0, failed: 0, message: "No tests to process" },
            })
          }

          const startTime = Date.now()
          const provider = getDefaultProvider()
          const expectedDimensions = getDimensionsForProvider(provider)
          let succeeded = 0
          let failed = 0

          const BATCH_SIZE = 10
          for (let i = 0; i < tests.length; i += BATCH_SIZE) {
            const batch = tests.slice(i, i + BATCH_SIZE)
            const texts = batch.map((t) =>
              prepareTestForEmbedding({ ...t, browser_name: t.browser })
            )

            try {
              const embeddings = await generateEmbeddingsBatchWithProvider(texts, {
                provider,
                task: "retrieval.passage",
              })

              for (let j = 0; j < batch.length; j++) {
                if (embeddings[j]?.length === expectedDimensions) {
                  const hash = generateEmbeddingHash(texts[j])
                  await sql`
                    UPDATE test_results
                    SET test_embedding = ${JSON.stringify(embeddings[j])}::vector,
                        test_embedding_hash = ${hash}
                    WHERE id = ${batch[j].id}
                  `
                  succeeded++
                } else {
                  failed++
                }
              }
            } catch {
              failed += batch.length
            }
          }

          return jsonResponse({
            organization: authContext.organizationSlug,
            action: "reembed",
            type: "test",
            stats: {
              total: tests.length,
              succeeded,
              failed,
              durationMs: Date.now() - startTime,
              provider,
              dimensions: expectedDimensions,
            },
          })
        }

        // ---- ERROR EMBEDDINGS (failures only, default) ----
        const {
          generateAndStoreEmbeddingsBatch,
          getEmbeddingConfig,
        } = await import("@/lib/services/embedding-service")

        const version = p.version || "v2"

        // Build WHERE clause for stats (base filter)
        const statsWhereClause = p.execution_id
          ? `te.organization_id = ${orgId} AND tr.status IN ('failed', 'timedout') AND tr.execution_id = ${p.execution_id}`
          : `te.organization_id = ${orgId} AND tr.status IN ('failed', 'timedout')`

        // Get stats first
        const statsResults = await sql`
          SELECT
            COUNT(*) as total_failed,
            COUNT(*) FILTER (WHERE tr.error_embedding IS NOT NULL) as with_v1,
            COUNT(*) FILTER (WHERE tr.error_embedding_v2 IS NOT NULL) as with_v2,
            COUNT(*) FILTER (WHERE tr.error_embedding IS NULL) as without_v1,
            COUNT(*) FILTER (WHERE tr.error_embedding_v2 IS NULL) as without_v2
          FROM test_results tr
          INNER JOIN test_executions te ON tr.execution_id = te.id
          WHERE ${sql.unsafe(statsWhereClause)}
        ` as Array<{
          total_failed: string
          with_v1: string
          with_v2: string
          without_v1: string
          without_v2: string
        }>
        const stats = statsResults[0]

        // Dry run - just return preview
        if (dryRun) {
          const toProcess = force
            ? Number(stats.total_failed)
            : version === "v1"
              ? Number(stats.without_v1)
              : Number(stats.without_v2)

          return jsonResponse({
            organization: authContext.organizationSlug,
            action: "reembed",
            type: "error",
            preview: {
              totalFailed: Number(stats.total_failed),
              withV1: Number(stats.with_v1),
              withV2: Number(stats.with_v2),
              toProcess: Math.min(toProcess, limitCount),
              version,
              force,
            },
          })
        }

        // Build WHERE clause for fetching tests
        const whereClauses: string[] = [
          `te.organization_id = ${orgId}`,
          "tr.status IN ('failed', 'timedout')",
          "(tr.error_message IS NOT NULL OR tr.stack_trace IS NOT NULL)",
        ]

        if (p.execution_id) {
          whereClauses.push(`tr.execution_id = ${p.execution_id}`)
        }

        // Add embedding filter if not force mode
        if (!force) {
          if (version === "v1") {
            whereClauses.push("tr.error_embedding IS NULL")
          } else {
            whereClauses.push("tr.error_embedding_v2 IS NULL")
          }
        }

        const whereClause = whereClauses.join(" AND ")
        const fullWhereAndLimit = `${whereClause} ORDER BY tr.created_at DESC LIMIT ${limitCount}`

        // Get tests to process
        const testsToProcess = await sql`
          SELECT tr.id, tr.error_message, tr.stack_trace
          FROM test_results tr
          INNER JOIN test_executions te ON tr.execution_id = te.id
          WHERE ${sql.unsafe(fullWhereAndLimit)}
        ` as Array<{
          id: number
          error_message: string | null
          stack_trace: string | null
        }>

        if (testsToProcess.length === 0) {
          return jsonResponse({
            organization: authContext.organizationSlug,
            action: "reembed",
            type: "error",
            stats: {
              total: 0,
              succeeded: 0,
              failed: 0,
              skipped: 0,
              message: "No tests to process",
            },
          })
        }

        // Process in batches
        const startTime = Date.now()
        let succeeded = 0
        let failed = 0
        let skipped = 0

        const BATCH_SIZE = 10
        for (let i = 0; i < testsToProcess.length; i += BATCH_SIZE) {
          const batch = testsToProcess.slice(i, i + BATCH_SIZE)
          const results = await generateAndStoreEmbeddingsBatch(batch)

          for (const result of results) {
            if (result.success) {
              succeeded++
            } else if (result.error === "No error content to embed") {
              skipped++
            } else {
              failed++
            }
          }
        }

        const durationMs = Date.now() - startTime
        const config = getEmbeddingConfig()

        return jsonResponse({
          organization: authContext.organizationSlug,
          action: "reembed",
          type: "error",
          stats: {
            total: testsToProcess.length,
            succeeded,
            failed,
            skipped,
            durationMs,
            provider: config.provider,
            dimensions: config.dimensions,
          },
        })
      }

      // ============================================
      // Mock API Actions
      // ============================================
      case "create_mock_interface": {
        if (!p.name) {
          return errorResponse("create_mock_interface requires params.name")
        }

        const slug = p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50)

        const mockInterface = await db.createMockInterface(orgId, {
          name: p.name,
          slug,
          description: p.description,
          rate_limit_rpm: p.rate_limit_rpm,
        })

        // Get org slug for public URL
        const orgSlug = authContext.organizationSlug
        const baseUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://exolar.vercel.app")
        const publicUrl = `${baseUrl}/api/mock/${orgSlug}/${mockInterface.slug}`

        return jsonResponse({
          organization: orgSlug,
          action: "create_mock_interface",
          data: mockInterface,
          public_url: publicUrl,
          next_steps: [
            `Add routes: perform_exolar_action({ action: "create_mock_route", params: { interface_id: ${mockInterface.id}, path_pattern: "/users/:id", method: "GET" } })`,
          ],
        })
      }

      case "create_mock_route": {
        if (!p.interface_id) {
          return errorResponse("create_mock_route requires params.interface_id")
        }
        if (!p.path_pattern) {
          return errorResponse("create_mock_route requires params.path_pattern")
        }

        const route = await db.createMockRoute(p.interface_id, {
          path_pattern: p.path_pattern,
          method: p.method || "GET",
          description: p.description,
          priority: p.priority,
        })

        return jsonResponse({
          organization: authContext.organizationSlug,
          action: "create_mock_route",
          data: route,
          next_steps: [
            `Add rules: perform_exolar_action({ action: "create_mock_rule", params: { route_id: ${route.id}, name: "Success", response_status: 200, response_body: '{"message": "ok"}' } })`,
          ],
        })
      }

      case "create_mock_rule": {
        if (!p.route_id) {
          return errorResponse("create_mock_rule requires params.route_id")
        }
        if (!p.name) {
          return errorResponse("create_mock_rule requires params.name")
        }

        const rule = await db.createMockResponseRule(p.route_id, {
          name: p.name,
          match_headers: p.match_headers,
          match_query: p.match_query,
          match_body: p.match_body,
          match_body_contains: p.match_body_contains,
          response_status: p.response_status ?? 200,
          response_headers: p.response_headers,
          response_body: p.response_body || "",
          response_delay_ms: p.response_delay_ms,
          priority: p.priority,
        })

        return jsonResponse({
          organization: authContext.organizationSlug,
          action: "create_mock_rule",
          data: rule,
          templating_help: {
            available_variables: [
              "{{request.body.fieldName}} - Access JSON body fields",
              "{{request.query.paramName}} - Access query parameters",
              "{{request.headers.headerName}} - Access headers",
              "{{request.params.paramName}} - Access path parameters",
              "{{uuid}} - Generate random UUID",
              "{{timestamp}} - Current ISO timestamp",
            ],
          },
        })
      }

      case "delete_mock_interface": {
        if (!p.interface_id) {
          return errorResponse("delete_mock_interface requires params.interface_id")
        }

        await db.deleteMockInterface(orgId, p.interface_id)

        return jsonResponse({
          organization: authContext.organizationSlug,
          action: "delete_mock_interface",
          deleted_interface_id: p.interface_id,
          message: "Mock interface and all associated routes, rules, and logs have been deleted",
        })
      }

      default:
        return errorResponse(`Unknown action: ${input.action}`)
    }
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Action execution failed")
  }
}

function jsonResponse(data: unknown): ToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  }
}

function textResponse(text: string): ToolResponse {
  return {
    content: [{ type: "text", text }],
  }
}

function errorResponse(message: string): ToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  }
}
