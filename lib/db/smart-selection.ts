// lib/db/smart-selection.ts
// Persistence + queries for the smart_selection_decisions table.
// See migration scripts/029_add_smart_selection_decisions.sql.

import { getSql } from "./connection"
import { mapCatalogSuiteToExolar } from "../smart-selection/suite-map"

export type SmartSelectionMode = "shadow" | "active" | "active_overridden"

export interface SmartSelectionDecisionRecord {
  organization_id: number
  repository: string
  pr_number: number
  base_sha: string
  head_sha: string
  author: string
  mode: SmartSelectionMode
  model: string
  system_prompt_hash: string
  input: {
    file_count: number
    sanitized_token_count: number
    dropped_paths_count: number
    // Optional since ENG-1444 simplified the client-side sanitizer
    // ("let the LLM do its work" removed tier-based size gating).
    sanitizer_tier?: 1 | 2 | 3
  }
  output: {
    selected_suites: string[]
    skipped_suites: string[]
    // Nullable since ENG-1434: the Eve agent sends decision-only events with
    // no confidence score. Metrics/confidence get backfilled later by a
    // query-time join — not implemented here.
    confidence: number | null
    observation: string
    uncertainty_flags: string[]
  }
  // Optional since ENG-1434: decision-only rows (Eve agent) omit what
  // actually ran.
  actual_run?: {
    suites_run: string[]
    outcomes: Record<string, "passed" | "failed" | "timed_out">
  }
  // Optional since ENG-1434: decision-only rows have no confusion-matrix
  // metrics yet.
  metrics?: {
    false_negatives: number
    false_positives: number
    true_positives: number
    true_negatives: number
  }
  // Optional since ENG-1434: the Eve agent's decision-only events may not
  // have per-turn inference latency / token usage available from its tool
  // context.
  timing?: {
    inference_latency_ms: number
    input_tokens: number
    output_tokens: number
  }
  catalog_drift: {
    structural: Array<{ kind: "extra-test-dir" | "unmapped-feature-dir"; name: string }>
    coverage: Array<{ suiteName: string; oldHash: string; newHash: string }>
  }
}

export async function insertSmartSelectionDecision(
  rec: SmartSelectionDecisionRecord,
): Promise<{ event_id: string }> {
  const sql = getSql()
  // RLS bypass for service-account writes from CI: `SET LOCAL` only applies
  // within the same transaction, and the Neon serverless driver returns a
  // fresh pooled connection on every top-level `sql` call. Submitting both
  // statements inside `sql.transaction([...])` guarantees they hit the SAME
  // connection in ONE HTTP round-trip, so the SET LOCAL is active when the
  // INSERT runs and doesn't leak to other requests.
  const results = await sql.transaction([
    sql`SET LOCAL app.is_service_account = 'true'`,
    sql`
    INSERT INTO smart_selection_decisions (
      organization_id,
      repository,
      pr_number,
      base_sha,
      head_sha,
      author,
      mode,
      model,
      system_prompt_hash,
      input,
      output,
      actual_run,
      metrics,
      timing,
      catalog_drift
    ) VALUES (
      ${rec.organization_id},
      ${rec.repository},
      ${rec.pr_number},
      ${rec.base_sha},
      ${rec.head_sha},
      ${rec.author},
      ${rec.mode},
      ${rec.model},
      ${rec.system_prompt_hash},
      ${JSON.stringify(rec.input)}::jsonb,
      ${JSON.stringify(rec.output)}::jsonb,
      ${rec.actual_run ? JSON.stringify(rec.actual_run) : null}::jsonb,
      ${rec.metrics ? JSON.stringify(rec.metrics) : null}::jsonb,
      ${rec.timing ? JSON.stringify(rec.timing) : null}::jsonb,
      ${JSON.stringify(rec.catalog_drift)}::jsonb
    )
    ON CONFLICT (organization_id, repository, pr_number, head_sha, mode) DO UPDATE SET
      base_sha = EXCLUDED.base_sha,
      author = EXCLUDED.author,
      model = EXCLUDED.model,
      system_prompt_hash = EXCLUDED.system_prompt_hash,
      input = EXCLUDED.input,
      output = EXCLUDED.output,
      actual_run = EXCLUDED.actual_run,
      metrics = EXCLUDED.metrics,
      timing = EXCLUDED.timing,
      catalog_drift = EXCLUDED.catalog_drift,
      created_at = NOW()
    RETURNING id
  `,
  ])
  // sql.transaction([SET LOCAL, INSERT RETURNING id]) → [setRows, insertRows]
  const insertRows = results[1] as Array<{ id: number | string }>
  return { event_id: String(insertRows[0].id) }
}

export interface ListDecisionsOptions {
  organizationId: number
  repository?: string
  prNumber?: number
  mode?: SmartSelectionMode
  limit?: number
}

export async function listSmartSelectionDecisions(
  options: ListDecisionsOptions,
): Promise<Array<SmartSelectionDecisionRecord & { id: number; created_at: string }>> {
  const sql = getSql()
  const limit = options.limit ?? 50
  const rows = await sql`
    SELECT
      id,
      organization_id,
      repository,
      pr_number,
      base_sha,
      head_sha,
      author,
      mode,
      model,
      system_prompt_hash,
      input,
      output,
      actual_run,
      metrics,
      timing,
      catalog_drift,
      created_at
    FROM smart_selection_decisions
    WHERE organization_id = ${options.organizationId}
      AND (${options.repository ?? null}::text IS NULL OR repository = ${options.repository ?? null})
      AND (${options.prNumber ?? null}::int IS NULL OR pr_number = ${options.prNumber ?? null})
      AND (${options.mode ?? null}::text IS NULL OR mode = ${options.mode ?? null})
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return rows as Array<SmartSelectionDecisionRecord & { id: number; created_at: string }>
}

export interface FalseNegativeStats {
  total_active_decisions: number
  active_false_negatives: number
  shadow_decisions_count: number
  shadow_false_negatives: number
}

/**
 * Phase D circuit-breaker query: count active-mode false negatives in the last N days.
 * Plus shadow-mode counts for the calibration audit.
 *
 * Derives false-negatives from the COMPUTED test-outcome join (ENG-1434),
 * not the stored `metrics` blob: decision-only rows (the Eve agent) have
 * `metrics` NULL forever, so a SQL-side `(metrics->>'false_negatives')::int`
 * filter would silently never count them. Instead we fetch the in-window
 * decisions and run each through `getComputedMetricsForDecision` (the same
 * join `smart_selection_decisions` MCP queries use), then aggregate —
 * counting a decision once it has at least one computed false negative.
 */
export async function getRecentFalseNegativeStats(
  organizationId: number,
  windowDays = 7,
): Promise<FalseNegativeStats> {
  const sql = getSql()
  const rows = (await sql`
    SELECT
      mode,
      head_sha,
      output,
      metrics
    FROM smart_selection_decisions
    WHERE organization_id = ${organizationId}
      AND created_at > NOW() - (${windowDays} * INTERVAL '1 day')
      AND mode IN ('active', 'shadow')
  `) as Array<{
    mode: SmartSelectionMode
    head_sha: string
    output: { selected_suites: string[]; skipped_suites: string[] }
    metrics: ComputedConfusionMatrix | null
  }>

  let total_active_decisions = 0
  let active_false_negatives = 0
  let shadow_decisions_count = 0
  let shadow_false_negatives = 0

  await Promise.all(
    rows.map(async (row) => {
      const { metrics } = await getComputedMetricsForDecision(
        organizationId,
        row.head_sha,
        row.output,
        row.metrics ?? null,
      )
      const hasFalseNegative = (metrics?.false_negatives ?? 0) > 0
      if (row.mode === "active") {
        total_active_decisions++
        if (hasFalseNegative) active_false_negatives++
      } else if (row.mode === "shadow") {
        shadow_decisions_count++
        if (hasFalseNegative) shadow_false_negatives++
      }
    }),
  )

  return {
    total_active_decisions,
    active_false_negatives,
    shadow_decisions_count,
    shadow_false_negatives,
  }
}

// =====================================================
// Metrics-via-join (ENG-1434)
// =====================================================
//
// Decision-only rows (the Eve agent) have no `metrics`/`actual_run` blob —
// they only say what was selected/skipped. Exolar separately records what
// actually happened per suite per commit in `test_executions`/`test_results`.
// Instead of trusting a stored blob (which legacy CI clients wrote at
// decision-time, before tests even ran), we derive the confusion matrix at
// query time by joining the decision's (organization, head_sha) to the test
// outcomes recorded for that same commit.

export type SuiteVerdict = "passed" | "failed" | "timed_out"

export interface ComputedConfusionMatrix {
  false_negatives: number
  false_positives: number
  true_positives: number
  true_negatives: number
}

export type UnmeasurableReason = "unmappable_suite" | "no_execution_for_commit"

export interface UnmeasurableSuite {
  suite: string
  reason: UnmeasurableReason
}

export interface SmartSelectionMetricsResult {
  /** null when no test_executions have landed yet for this commit at all. */
  metrics: ComputedConfusionMatrix | null
  unmeasurable: UnmeasurableSuite[]
  source: "computed" | "legacy" | "none"
}

/**
 * Mirrors the CI `classify` semantics for a suite's outcome on a single
 * execution, given aggregate test_results counts for that execution:
 *   - any timed-out result -> timed_out (CI's classify() checks timeout
 *     first — a timeout wins over a failure)
 *   - else any failed result -> failed
 *   - else no results at all (nothing ran) -> failed (conservative: we never
 *     want "nothing ran" to look like a pass)
 *   - else -> passed
 */
export function verdictFromCounts(
  failedCount: number,
  timedOutCount: number,
  resultCount: number,
): SuiteVerdict {
  if (timedOutCount > 0) return "timed_out"
  if (failedCount > 0) return "failed"
  if (resultCount === 0) return "failed"
  return "passed"
}

/**
 * Fetch the latest per-suite verdict for every Exolar-recorded suite that
 * ran on `commitSha` within `organizationId`. Suites with multiple
 * executions for the same commit (e.g. re-runs) only contribute their most
 * recent execution.
 *
 * Returns an empty Map when no test_executions exist yet for this commit —
 * callers treat that as "tests haven't finished" rather than an error.
 */
export async function getSuiteVerdictsForCommit(
  organizationId: number,
  commitSha: string,
): Promise<Map<string, SuiteVerdict>> {
  const sql = getSql()
  // Join key: (organization_id, commit_sha). `test_executions` has no
  // `repository` column, so org-scoping is used as a proxy for repo-scoping.
  // Safe given one repo per org today; the only risk is a cross-repo
  // same-SHA collision within the same org, which isn't possible until an
  // org owns more than one repo.
  const rows = (await sql`
    SELECT
      te.suite AS suite,
      te.started_at AS started_at,
      COUNT(*) FILTER (WHERE tr.status = 'failed') AS failed_count,
      COUNT(*) FILTER (WHERE tr.status = 'timedout') AS timed_out_count,
      COUNT(tr.id) FILTER (WHERE tr.status <> 'skipped') AS result_count
    FROM test_executions te
    LEFT JOIN test_results tr ON tr.execution_id = te.id
    WHERE te.organization_id = ${organizationId}
      AND te.commit_sha = ${commitSha}
      AND te.suite IS NOT NULL
    GROUP BY te.id, te.suite, te.started_at
    ORDER BY te.suite ASC, te.started_at DESC
  `) as Array<{
    suite: string
    started_at: string
    failed_count: number | string
    timed_out_count: number | string
    result_count: number | string
  }>

  const verdicts = new Map<string, SuiteVerdict>()
  const seenSuites = new Set<string>()
  for (const row of rows) {
    // Rows are ordered per-suite by started_at DESC, so the first row seen
    // for a suite is its latest execution — skip any older re-runs.
    if (seenSuites.has(row.suite)) continue
    seenSuites.add(row.suite)
    verdicts.set(
      row.suite,
      verdictFromCounts(
        Number(row.failed_count),
        Number(row.timed_out_count),
        Number(row.result_count),
      ),
    )
  }
  return verdicts
}

/**
 * Pure confusion-matrix derivation from already-fetched suite verdicts.
 * Kept separate from the DB fetch so it's trivially unit-testable.
 *
 * FN = mapped SKIPPED suite that failed/timed_out
 * FP = mapped SELECTED suite that passed
 * TP = mapped SELECTED suite that failed/timed_out
 * TN = mapped SKIPPED suite that passed
 * Unmappable suites and suites with no execution for the commit are
 * EXCLUDED from the counts (never counted as passing) and reported as
 * unmeasurable.
 */
export function deriveSmartSelectionMetrics(
  selectedSuites: string[],
  skippedSuites: string[],
  verdictsByExolarSuite: Map<string, SuiteVerdict>,
): { metrics: ComputedConfusionMatrix; unmeasurable: UnmeasurableSuite[] } {
  let true_positives = 0
  let false_positives = 0
  let true_negatives = 0
  let false_negatives = 0
  const unmeasurable: UnmeasurableSuite[] = []

  function classify(catalogSuite: string, disposition: "selected" | "skipped") {
    const exolarName = mapCatalogSuiteToExolar(catalogSuite)
    if (exolarName === null) {
      unmeasurable.push({ suite: catalogSuite, reason: "unmappable_suite" })
      return
    }
    const verdict = verdictsByExolarSuite.get(exolarName)
    if (!verdict) {
      unmeasurable.push({ suite: catalogSuite, reason: "no_execution_for_commit" })
      return
    }
    const failedOrTimedOut = verdict === "failed" || verdict === "timed_out"
    if (disposition === "selected") {
      if (failedOrTimedOut) true_positives++
      else false_positives++
    } else {
      if (failedOrTimedOut) false_negatives++
      else true_negatives++
    }
  }

  for (const suite of selectedSuites) classify(suite, "selected")
  for (const suite of skippedSuites) classify(suite, "skipped")

  return {
    metrics: { true_positives, false_positives, true_negatives, false_negatives },
    unmeasurable,
  }
}

/**
 * Compute (or fall back to legacy) confusion-matrix metrics for a single
 * decision row. Never throws on missing data — decision-only rows
 * self-heal once the corresponding test_executions land.
 */
export async function getComputedMetricsForDecision(
  organizationId: number,
  headSha: string,
  output: { selected_suites: string[]; skipped_suites: string[] },
  legacyMetrics?: ComputedConfusionMatrix | null,
): Promise<SmartSelectionMetricsResult> {
  const verdicts = await getSuiteVerdictsForCommit(organizationId, headSha)

  if (verdicts.size === 0) {
    // No test_executions have landed yet for this commit at all — tests are
    // still running, or this commit never got tested. Don't error; either
    // fall back to a legacy stored blob or report empty/null metrics so the
    // UI can show "pending" instead of crashing.
    if (legacyMetrics) {
      return { metrics: legacyMetrics, unmeasurable: [], source: "legacy" }
    }
    const unmeasurable: UnmeasurableSuite[] = [
      ...output.selected_suites.map((suite) => ({
        suite,
        reason: (mapCatalogSuiteToExolar(suite) === null
          ? "unmappable_suite"
          : "no_execution_for_commit") as UnmeasurableReason,
      })),
      ...output.skipped_suites.map((suite) => ({
        suite,
        reason: (mapCatalogSuiteToExolar(suite) === null
          ? "unmappable_suite"
          : "no_execution_for_commit") as UnmeasurableReason,
      })),
    ]
    return { metrics: null, unmeasurable, source: "none" }
  }

  const { metrics, unmeasurable } = deriveSmartSelectionMetrics(
    output.selected_suites,
    output.skipped_suites,
    verdicts,
  )
  return { metrics, unmeasurable, source: "computed" }
}
