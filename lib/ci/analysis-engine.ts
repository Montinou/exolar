import { getSql } from "@/lib/db/connection"
import { getFailureClassification } from "@/lib/db/classification"
import { clusterFailures } from "@/lib/db/clustering"

// -- Exported Types --

export type FailureCategory = "HEALABLE" | "REAL_BUG" | "KNOWN_FLAKE" | "INFRA" | "MANUAL_REVIEW"
export type FixStrategy =
  | "selector_update"
  | "wait_adjustment"
  | "race_condition"
  | "api_timing"
  | "retry_logic"

export interface HealableFailure {
  test_signature: string
  test_file: string
  test_name: string
  error_type: string
  error_message: string
  fix_strategy: FixStrategy
  confidence: number
  ai_context: Record<string, unknown> | null
  similar_past_fixes: Array<{ signature: string; strategy: string; success: boolean }>
}

export interface DetectedBug {
  summary: string
  test_signatures: string[]
  root_cause_cluster: string
  confidence: number
  issue_body: string
  evidence: {
    error_message: string
    stack_trace: string | null
    first_seen_commit: string | null
    affected_tests_count: number
    regression_in_commit: boolean
  }
}

export interface KnownFlake {
  test_signature: string
  test_name: string
  flakiness_rate: number
  recommendation: string
}

export interface InfraIssue {
  test_signatures: string[]
  error_pattern: string
  recommendation: string
}

export interface AnalysisResult {
  execution_id: number
  total_failures: number
  action_plan: {
    healable: HealableFailure[]
    bugs: DetectedBug[]
    known_flakes: KnownFlake[]
    infra_issues: InfraIssue[]
    manual_review: Array<{ test_signature: string; reason: string }>
  }
  confidence: number
}

// -- Internal Helpers --

function selectFixStrategy(
  errorType: string,
  errorMessage: string,
  retryCount: number,
  passedOnRetry: boolean,
  aiContext: Record<string, unknown> | null
): FixStrategy {
  const lastStep = (aiContext?.last_step as string | undefined) ?? ""
  const lastApi = aiContext?.last_api as { status?: number } | undefined

  if (errorType === "TimeoutError" && lastStep.toLowerCase().includes("waitfor")) return "wait_adjustment"
  if (errorType === "LocatorError") return "selector_update"
  if (retryCount > 0 && passedOnRetry) return "race_condition"
  if (lastApi?.status && lastApi.status >= 500) return "api_timing"
  if (errorMessage.toLowerCase().includes("stale")) return "retry_logic"
  if (errorType === "TimeoutError") return "wait_adjustment"
  return "retry_logic"
}

function isInfraError(errorMessage: string | null, errorType: string | null): boolean {
  const msg = (errorMessage ?? "").toLowerCase()
  const type = (errorType ?? "").toLowerCase()
  return (
    type === "networkerror" ||
    msg.includes("networkerror") ||
    msg.includes("econnrefused") ||
    msg.includes("net::") ||
    /\b(?:status|http|error)\s*:?\s*5\d{2}\b/i.test(msg)
  )
}

function buildIssueBody(
  label: string,
  signatures: string[],
  error: string,
  stackTrace: string | null,
  commitSha: string | null
): string {
  const commitLine = commitSha ? `**First seen commit:** \`${commitSha}\`\n` : ""
  const testList = signatures.map((s) => `- \`${s}\``).join("\n")
  const stackSection = stackTrace
    ? `\n### Stack Trace\n\`\`\`\n${stackTrace.slice(0, 600)}\n\`\`\``
    : ""
  return `## Bug Report: ${label}\n\n> **Regression detected.**\n\n### Affected Tests (${signatures.length})\n${testList}\n\n### Error\n\`\`\`\n${error}\n\`\`\`${stackSection}\n\n### Metadata\n${commitLine}**Affected tests:** ${signatures.length}\n`
}

// -- Core Analysis Function --

/** Analyze all failures in a CI execution and produce a structured action plan. */
export async function analyzeExecution(
  executionId: number,
  orgId: number
): Promise<AnalysisResult> {
  const sql = getSql()

  // 1. Fetch all failed/timedout test results (parameterized to prevent SQL injection)
  const rawFailures = await sql.query(
    `SELECT
      tr.id,
      COALESCE(tr.test_signature, MD5(tr.test_file || '::' || tr.test_name)) AS test_signature,
      tr.test_name,
      tr.test_file,
      tr.status,
      tr.retry_count,
      tr.error_message,
      tr.stack_trace,
      tr.ai_context,
      te.commit_sha,
      EXISTS (
        SELECT 1 FROM test_results tr2
        WHERE tr2.execution_id = tr.execution_id
          AND tr2.test_signature = tr.test_signature
          AND tr2.status = 'passed'
          AND tr2.retry_count > tr.retry_count
      ) AS passed_on_retry
    FROM test_results tr
    JOIN test_executions te ON tr.execution_id = te.id
    WHERE tr.execution_id = $1
      AND te.organization_id = $2
      AND tr.status IN ('failed', 'timedout')
    ORDER BY tr.id ASC
    LIMIT 500`,
    [executionId, orgId]
  )

  const failures = rawFailures as Array<Record<string, unknown>>

  const actionPlan: AnalysisResult["action_plan"] = {
    healable: [],
    bugs: [],
    known_flakes: [],
    infra_issues: [],
    manual_review: [],
  }

  type BugCandidate = {
    test_signature: string
    test_name: string
    error_message: string
    stack_trace: string | null
    commit_sha: string | null
    confidence: number
  }
  const bugCandidates: BugCandidate[] = []
  const infraMap = new Map<string, string[]>()

  // 2. Classify each failure
  for (const row of failures) {
    const testSignature = row.test_signature as string
    const testName = row.test_name as string
    const testFile = row.test_file as string
    const errorMessage = (row.error_message as string | null) ?? ""
    const stackTrace = row.stack_trace as string | null
    const aiContext = row.ai_context as Record<string, unknown> | null
    const retryCount = Number(row.retry_count)
    const status = row.status as string
    const commitSha = row.commit_sha as string | null

    const clf = await getFailureClassification(orgId, { testId: Number(row.id) })

    const errorType = clf?.current_failure.error_type ?? null
    const confidence = clf ? clf.confidence * 100 : 0
    const classification = clf?.suggested_classification ?? "UNKNOWN"
    const flakinessRate = clf?.historical_metrics.flakiness_rate ?? 0
    const passedOnRetry = Boolean(row.passed_on_retry)


    // 3. Decision matrix
    let category: FailureCategory
    if (isInfraError(errorMessage, errorType)) category = "INFRA"
    else if (confidence < 70) category = "MANUAL_REVIEW"
    else if (classification === "FLAKE" && flakinessRate > 10 && passedOnRetry) category = "KNOWN_FLAKE"
    else if (classification === "FLAKE" && (errorType === "TimeoutError" || errorType === "LocatorError")) category = "HEALABLE"
    else if (classification === "BUG") category = "REAL_BUG"
    else category = "MANUAL_REVIEW"

    // 4. Build action plan entries
    if (category === "INFRA") {
      const pattern = errorType ?? "NetworkError"
      infraMap.set(pattern, [...(infraMap.get(pattern) ?? []), testSignature])
    } else if (category === "KNOWN_FLAKE") {
      actionPlan.known_flakes.push({
        test_signature: testSignature,
        test_name: testName,
        flakiness_rate: flakinessRate,
        recommendation: `${flakinessRate.toFixed(1)}% flakiness rate — passed on retry. Consider retry logic or timing investigation.`,
      })
    } else if (category === "HEALABLE") {
      actionPlan.healable.push({
        test_signature: testSignature,
        test_file: testFile,
        test_name: testName,
        error_type: errorType ?? "UnknownError",
        error_message: errorMessage,
        fix_strategy: selectFixStrategy(errorType ?? "UnknownError", errorMessage, retryCount, passedOnRetry, aiContext),
        confidence: clf?.confidence ?? 0,
        ai_context: aiContext,
        similar_past_fixes: [],
      })
    } else if (category === "REAL_BUG") {
      bugCandidates.push({ test_signature: testSignature, test_name: testName, error_message: errorMessage, stack_trace: stackTrace, commit_sha: commitSha, confidence: clf?.confidence ?? 0 })
    } else {
      actionPlan.manual_review.push({
        test_signature: testSignature,
        reason: confidence < 70
          ? `Low classification confidence (${confidence.toFixed(0)}%)`
          : "Mixed signals — manual triage recommended",
      })
    }
  }

  // 5. Group BUG candidates by semantic cluster
  const clusters = await clusterFailures(executionId)
  const clusteredNames = new Set(clusters.flatMap((c) => c.tests.map((t) => t.testName)))

  for (const cluster of clusters) {
    const clusterTestNames = new Set(cluster.tests.map((t) => t.testName))
    const matched = bugCandidates.filter((c) => clusterTestNames.has(c.test_name))
    if (matched.length === 0) continue

    const rep = cluster.tests.find((t) => t.isRepresentative)
    const repError = rep?.errorMessage ?? matched[0].error_message
    const signatures = matched.map((c) => c.test_signature)
    const avgConfidence = matched.reduce((s, c) => s + c.confidence, 0) / matched.length
    const label = `Cluster ${cluster.clusterId}: ${repError?.slice(0, 60) ?? "unknown error"}`

    actionPlan.bugs.push({
      summary: label,
      test_signatures: signatures,
      root_cause_cluster: cluster.representativeError ?? label,
      confidence: Math.round(avgConfidence * 100) / 100,
      issue_body: buildIssueBody(label, signatures, repError ?? "Unknown error", matched[0].stack_trace, matched[0].commit_sha),
      evidence: {
        error_message: repError ?? "Unknown error",
        stack_trace: matched[0].stack_trace,
        first_seen_commit: matched[0].commit_sha,
        affected_tests_count: signatures.length,
        regression_in_commit: true,
      },
    })
  }

  // Unclustered bug candidates become individual bug entries
  for (const candidate of bugCandidates) {
    if (!clusteredNames.has(candidate.test_name)) {
      actionPlan.bugs.push({
        summary: `Test failure: ${candidate.test_name}`,
        test_signatures: [candidate.test_signature],
        root_cause_cluster: candidate.test_name,
        confidence: candidate.confidence,
        issue_body: buildIssueBody(candidate.test_name, [candidate.test_signature], candidate.error_message, candidate.stack_trace, candidate.commit_sha),
        evidence: {
          error_message: candidate.error_message,
          stack_trace: candidate.stack_trace,
          first_seen_commit: candidate.commit_sha,
          affected_tests_count: 1,
          regression_in_commit: true,
        },
      })
    }
  }

  // 6. Flatten infra map
  for (const [pattern, signatures] of infraMap.entries()) {
    actionPlan.infra_issues.push({
      test_signatures: signatures,
      error_pattern: pattern,
      recommendation: `${signatures.length} test(s) failed with ${pattern}. Check network connectivity and service availability.`,
    })
  }

  // 7. Overall confidence — weighted average across all categorized items
  const totalCategorized =
    actionPlan.healable.length + actionPlan.bugs.length +
    actionPlan.known_flakes.length + actionPlan.infra_issues.length +
    actionPlan.manual_review.length

  const overallConfidence = totalCategorized === 0
    ? 1
    : Math.round(
        ((actionPlan.healable.reduce((s, h) => s + h.confidence, 0) +
          actionPlan.bugs.reduce((s, b) => s + b.confidence, 0) +
          actionPlan.known_flakes.length * 0.85 +
          actionPlan.infra_issues.length * 0.9 +
          actionPlan.manual_review.length * 0.4) /
          totalCategorized) * 100
      ) / 100

  return {
    execution_id: executionId,
    total_failures: failures.length,
    action_plan: actionPlan,
    confidence: overallConfidence,
  }
}
