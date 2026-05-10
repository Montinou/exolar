// lib/db/smart-selection.ts
// Persistence + queries for the smart_selection_decisions table.
// See migration scripts/029_add_smart_selection_decisions.sql.

import { getSql } from "./connection"

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
    sanitizer_tier: 1 | 2 | 3
  }
  output: {
    selected_suites: string[]
    skipped_suites: string[]
    confidence: number
    observation: string
    uncertainty_flags: string[]
  }
  actual_run: {
    suites_run: string[]
    outcomes: Record<string, "passed" | "failed" | "timed_out">
  }
  metrics: {
    false_negatives: number
    false_positives: number
    true_positives: number
    true_negatives: number
  }
  timing: {
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
  const rows = await sql`
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
      ${JSON.stringify(rec.actual_run)}::jsonb,
      ${JSON.stringify(rec.metrics)}::jsonb,
      ${JSON.stringify(rec.timing)}::jsonb,
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
  `
  return { event_id: String(rows[0].id) }
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
 */
export async function getRecentFalseNegativeStats(
  organizationId: number,
  windowDays = 7,
): Promise<FalseNegativeStats> {
  const sql = getSql()
  const rows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE mode = 'active') AS total_active_decisions,
      COUNT(*) FILTER (WHERE mode = 'active' AND (metrics->>'false_negatives')::int > 0) AS active_false_negatives,
      COUNT(*) FILTER (WHERE mode = 'shadow') AS shadow_decisions_count,
      COUNT(*) FILTER (WHERE mode = 'shadow' AND (metrics->>'false_negatives')::int > 0) AS shadow_false_negatives
    FROM smart_selection_decisions
    WHERE organization_id = ${organizationId}
      AND created_at > NOW() - (${windowDays} || ' days')::interval
  `
  const r = rows[0]
  return {
    total_active_decisions: Number(r.total_active_decisions ?? 0),
    active_false_negatives: Number(r.active_false_negatives ?? 0),
    shadow_decisions_count: Number(r.shadow_decisions_count ?? 0),
    shadow_false_negatives: Number(r.shadow_false_negatives ?? 0),
  }
}
