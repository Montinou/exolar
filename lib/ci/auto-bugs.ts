/**
 * Auto-bug-report module for CI-detected real bugs.
 *
 * When the analysis engine classifies a failure cluster as REAL_BUG,
 * this module handles GitHub issue creation with deduplication.
 */

import { getSql } from "@/lib/db/connection"
import type { DetectedBug } from "./analysis-engine"

export interface BugReportResult {
  bug_summary: string
  status: "created" | "duplicate" | "suppressed" | "failed"
  issue_url?: string
  issue_number?: number
  reason?: string
}

/**
 * Format a DetectedBug into a GitHub issue body.
 * Returns markdown-formatted issue body with all evidence.
 */
export function formatIssueBody(bug: DetectedBug, linearContext?: string): string {
  const sections: string[] = [
    `## Summary`,
    ``,
    bug.summary,
    ``,
    `## Evidence`,
    ``,
    `**Error Message:**`,
    "```",
    bug.evidence.error_message,
    "```",
    ``,
  ]

  if (bug.evidence.stack_trace) {
    sections.push(
      `**Stack Trace:**`,
      "```",
      bug.evidence.stack_trace.slice(0, 2000), // Truncate long traces
      "```",
      ``
    )
  }

  sections.push(
    `**Affected Tests (${bug.evidence.affected_tests_count}):**`,
    ...bug.test_signatures.slice(0, 10).map(s => `- \`${s}\``),
    bug.test_signatures.length > 10 ? `- ... and ${bug.test_signatures.length - 10} more` : "",
    ``
  )

  if (bug.evidence.first_seen_commit) {
    sections.push(
      `**First Seen:** commit \`${bug.evidence.first_seen_commit}\``,
      bug.evidence.regression_in_commit ? `**Warning: Regression detected in this commit**` : "",
      ``
    )
  }

  sections.push(
    `## Classification`,
    ``,
    `- **Root Cause Cluster:** ${bug.root_cause_cluster}`,
    `- **Confidence:** ${(bug.confidence * 100).toFixed(0)}%`,
    ``
  )

  if (linearContext) {
    sections.push(linearContext, ``)
  }

  sections.push(
    `---`,
    `*Auto-detected by [Exolar QA](https://exolar.qa) • Confidence: ${(bug.confidence * 100).toFixed(0)}%*`
  )

  return sections.filter(s => s !== "").join("\n")
}

/**
 * Record a bug report result in the database.
 */
export async function recordBugReport(
  analysisId: number,
  result: BugReportResult,
  bug: DetectedBug
): Promise<void> {
  const sql = getSql()
  await sql`
    INSERT INTO ci_auto_bugs (
      analysis_id, issue_url, issue_number, summary,
      root_cause_cluster, affected_signatures, status
    ) VALUES (
      ${analysisId},
      ${result.issue_url ?? null},
      ${result.issue_number ?? null},
      ${bug.summary},
      ${bug.root_cause_cluster},
      ${bug.test_signatures},
      ${result.status}
    )
  `
}

/**
 * Check if a similar bug has already been reported (deduplication).
 * Returns the existing issue URL if found.
 */
export async function findExistingBugReport(
  orgId: number,
  rootCauseCluster: string
): Promise<{ issue_url: string; issue_number: number } | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT cab.issue_url, cab.issue_number
    FROM ci_auto_bugs cab
    JOIN ci_analysis_results car ON car.id = cab.analysis_id
    WHERE car.organization_id = ${orgId}
      AND cab.root_cause_cluster = ${rootCauseCluster}
      AND cab.status IN ('reported', 'acknowledged')
      AND cab.issue_url IS NOT NULL
    ORDER BY cab.created_at DESC
    LIMIT 1
  `
  if (rows.length === 0) return null
  return {
    issue_url: rows[0].issue_url as string,
    issue_number: rows[0].issue_number as number,
  }
}
