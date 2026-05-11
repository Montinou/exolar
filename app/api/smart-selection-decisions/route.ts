import { NextResponse } from "next/server"
import { z } from "zod"
import { validateApiKey } from "@/lib/auth"
import { validateOrgApiKey, isExolarApiKey } from "@/lib/api-keys"
import {
  insertSmartSelectionDecision,
  type SmartSelectionDecisionRecord,
} from "@/lib/db"

export const dynamic = "force-dynamic"

const LEGACY_ORG_ID = 1

// =============================================================================
// Validation schema — mirrors the SmartSelectionEvent type emitted by the
// smart-selection client at:
//   attorney_share_mvp_web/automation/playwright/smart-selection/lib/exolar/log.ts
// =============================================================================
const suiteOutcomeEnum = z.enum(["passed", "failed", "timed_out"])

const smartSelectionEventSchema = z.object({
  pr_number: z.number().int().nonnegative(),
  repository: z.string().min(1),
  base_sha: z.string().min(1),
  head_sha: z.string().min(1),
  author: z.string().min(1),
  mode: z.enum(["shadow", "active", "active_overridden"]),
  model: z.string().min(1),
  system_prompt_hash: z.string().min(1),

  input: z.object({
    file_count: z.number().int().nonnegative(),
    sanitized_token_count: z.number().int().nonnegative(),
    dropped_paths_count: z.number().int().nonnegative(),
    sanitizer_tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }),

  output: z.object({
    selected_suites: z.array(z.string()),
    skipped_suites: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    observation: z.string(),
    uncertainty_flags: z.array(z.string()),
  }),

  actual_run: z.object({
    suites_run: z.array(z.string()),
    outcomes: z.record(suiteOutcomeEnum),
  }),

  metrics: z.object({
    false_negatives: z.number().int().nonnegative(),
    false_positives: z.number().int().nonnegative(),
    true_positives: z.number().int().nonnegative(),
    true_negatives: z.number().int().nonnegative(),
  }),

  timing: z.object({
    inference_latency_ms: z.number().nonnegative(),
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }),

  catalog_drift: z
    .object({
      structural: z.array(
        z.object({
          kind: z.enum(["extra-test-dir", "unmapped-feature-dir"]),
          name: z.string(),
        }),
      ),
      coverage: z.array(
        z.object({
          suiteName: z.string(),
          oldHash: z.string(),
          newHash: z.string(),
        }),
      ),
    })
    .default({ structural: [], coverage: [] }),
})

interface IngestResponse {
  success: boolean
  event_id?: string
  error?: string
}

/**
 * POST /api/smart-selection-decisions
 *
 * Ingests one smart_selection_decision event from the smart-selection CI step.
 * One row per (organization, repository, PR number, head_sha, mode) — re-runs
 * of the same commit dedupe via UPSERT.
 *
 * Auth: same shape as /api/test-results
 *   1. Bearer <exolar_...>     — org API key (preferred for CI)
 *   2. Bearer <DASHBOARD_API_KEY> — legacy single-tenant fallback (LEGACY_ORG_ID)
 */
export async function POST(request: Request): Promise<NextResponse<IngestResponse>> {
  const authHeader = request.headers.get("authorization")
  let organizationId: number

  if (isExolarApiKey(authHeader)) {
    const validatedKey = await validateOrgApiKey(authHeader)
    if (!validatedKey) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired API key" },
        { status: 401 },
      )
    }
    organizationId = validatedKey.organizationId
  } else if (validateApiKey(authHeader)) {
    organizationId = LEGACY_ORG_ID
  } else {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON in request body" },
      { status: 400 },
    )
  }

  const parsed = smartSelectionEventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: `Invalid payload: ${parsed.error.message}` },
      { status: 400 },
    )
  }
  const event = parsed.data

  const record: SmartSelectionDecisionRecord = {
    organization_id: organizationId,
    repository: event.repository,
    pr_number: event.pr_number,
    base_sha: event.base_sha,
    head_sha: event.head_sha,
    author: event.author,
    mode: event.mode,
    model: event.model,
    system_prompt_hash: event.system_prompt_hash,
    input: event.input,
    output: event.output,
    actual_run: event.actual_run,
    metrics: event.metrics,
    timing: event.timing,
    catalog_drift: event.catalog_drift,
  }

  try {
    // RLS bypass is handled inside insertSmartSelectionDecision: it submits
    // `SET LOCAL app.is_service_account = 'true'` + INSERT in a single
    // sql.transaction([...]) so the SET applies on the same connection as
    // the INSERT (Neon serverless returns a fresh pooled connection per
    // top-level call, so the previous setServiceAccountContext() pattern
    // didn't actually take effect).
    const { event_id } = await insertSmartSelectionDecision(record)
    return NextResponse.json({ success: true, event_id })
  } catch (error) {
    console.error("[POST /api/smart-selection-decisions] Database error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    )
  }
}
