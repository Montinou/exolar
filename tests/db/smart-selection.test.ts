import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/connection", () => ({
  getSql: vi.fn(),
}))

import { getSql } from "@/lib/db/connection"
import {
  insertSmartSelectionDecision,
  type SmartSelectionDecisionRecord,
} from "@/lib/db/smart-selection"

const baseRecord: SmartSelectionDecisionRecord = {
  organization_id: 7,
  repository: "attorneyshare/attorney_share_mvp_web",
  pr_number: 42,
  base_sha: "base123",
  head_sha: "head789",
  author: "eve-agent",
  mode: "shadow",
  model: "eve-agent-v1",
  system_prompt_hash: "abcd1234ef56",
  input: { file_count: 12 },
  output: {
    selected_suites: ["referrals.spec.ts"],
    skipped_suites: ["billing.spec.ts"],
    confidence: null,
    observation: "Changes confined to referrals module.",
    uncertainty_flags: [],
  },
  timing: { inference_latency_ms: 850, input_tokens: 1200, output_tokens: 90 },
  catalog_drift: { structural: [], coverage: [] },
}

// Captures the raw values bound into the tagged-template `sql\`...\`` calls
// so we can assert on the actual_run/metrics parameters without a live DB.
// Order of interpolations in the INSERT template (see lib/db/smart-selection.ts):
// [0]=organization_id .. [9]=input, [10]=output, [11]=actual_run, [12]=metrics,
// [13]=timing, [14]=catalog_drift
function mockTransaction(returnRows: unknown[]) {
  const transaction = vi.fn().mockResolvedValue([{ captured: true }, returnRows])
  const sqlTag = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }))
  ;(sqlTag as unknown as { transaction: typeof transaction }).transaction = transaction
  ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)
  return { sqlTag, transaction }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("insertSmartSelectionDecision", () => {
  it("stores a decision-only record with actual_run/metrics bound as NULL", async () => {
    const { transaction, sqlTag } = mockTransaction([{ id: 101 }])

    const result = await insertSmartSelectionDecision(baseRecord)

    expect(result).toEqual({ event_id: "101" })
    expect(transaction).toHaveBeenCalledTimes(1)

    // transaction() receives [setLocalFragment, insertFragment]
    const passedFragments = transaction.mock.calls[0][0] as Array<{ values: unknown[] }>
    const insertFragment = passedFragments[1]

    expect(insertFragment.values[11]).toBeNull() // actual_run
    expect(insertFragment.values[12]).toBeNull() // metrics
    // Sanity: never the literal string "undefined"
    expect(insertFragment.values).not.toContain("undefined")
    expect(sqlTag).toHaveBeenCalledTimes(2) // SET LOCAL + INSERT
  })

  it("stores a full record with actual_run/metrics JSON-serialized", async () => {
    const { transaction } = mockTransaction([{ id: 202 }])

    const fullRecord: SmartSelectionDecisionRecord = {
      ...baseRecord,
      output: { ...baseRecord.output, confidence: 0.87 },
      actual_run: {
        suites_run: ["referrals.spec.ts"],
        outcomes: { "referrals.spec.ts": "passed" },
      },
      metrics: {
        false_negatives: 0,
        false_positives: 0,
        true_positives: 1,
        true_negatives: 3,
      },
    }

    const result = await insertSmartSelectionDecision(fullRecord)
    expect(result).toEqual({ event_id: "202" })

    const passedFragments = transaction.mock.calls[0][0] as Array<{ values: unknown[] }>
    const insertFragment = passedFragments[1]

    expect(insertFragment.values[11]).toBe(JSON.stringify(fullRecord.actual_run))
    expect(insertFragment.values[12]).toBe(JSON.stringify(fullRecord.metrics))
  })

  it("stores a decision-only record with timing omitted as NULL", async () => {
    const { transaction } = mockTransaction([{ id: 303 }])

    const { timing: _timing, ...recordWithoutTiming } = baseRecord
    const result = await insertSmartSelectionDecision(
      recordWithoutTiming as SmartSelectionDecisionRecord,
    )
    expect(result).toEqual({ event_id: "303" })

    const passedFragments = transaction.mock.calls[0][0] as Array<{ values: unknown[] }>
    const insertFragment = passedFragments[1]

    expect(insertFragment.values[13]).toBeNull() // timing
  })

  it("stores merge_commit_sha and branch when present, appended after catalog_drift", async () => {
    const { transaction } = mockTransaction([{ id: 404 }])

    const recordWithJoinKeys: SmartSelectionDecisionRecord = {
      ...baseRecord,
      merge_commit_sha: "merge-sha-abc123",
      branch: "feat/eng-1434-eve-logging",
    }

    const result = await insertSmartSelectionDecision(recordWithJoinKeys)
    expect(result).toEqual({ event_id: "404" })

    const passedFragments = transaction.mock.calls[0][0] as Array<{ values: unknown[] }>
    const insertFragment = passedFragments[1]

    expect(insertFragment.values[15]).toBe("merge-sha-abc123") // merge_commit_sha
    expect(insertFragment.values[16]).toBe("feat/eng-1434-eve-logging") // branch
  })

  it("binds merge_commit_sha and branch as NULL when the record omits them", async () => {
    const { transaction } = mockTransaction([{ id: 505 }])

    const result = await insertSmartSelectionDecision(baseRecord)
    expect(result).toEqual({ event_id: "505" })

    const passedFragments = transaction.mock.calls[0][0] as Array<{ values: unknown[] }>
    const insertFragment = passedFragments[1]

    expect(insertFragment.values[15]).toBeNull()
    expect(insertFragment.values[16]).toBeNull()
  })
})
