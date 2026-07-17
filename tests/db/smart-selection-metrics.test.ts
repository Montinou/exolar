import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/connection", () => ({
  getSql: vi.fn(),
}))

import { getSql } from "@/lib/db/connection"
import {
  verdictFromCounts,
  deriveSmartSelectionMetrics,
  getSuiteVerdictsForCommit,
  getComputedMetricsForDecision,
} from "@/lib/db/smart-selection"
import { mapCatalogSuiteToExolar } from "@/lib/smart-selection/suite-map"

function mockSqlRows(rows: unknown[]) {
  const sqlTag = vi.fn().mockResolvedValue(rows)
  ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)
  return sqlTag
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("suite-map", () => {
  it("maps renamed catalog suites to their Exolar names", () => {
    expect(mapCatalogSuiteToExolar("marketplace-v2")).toBe("Marketplace")
    expect(mapCatalogSuiteToExolar("profile")).toBe("Edit Profile")
    expect(mapCatalogSuiteToExolar("negotiation")).toBe("Negotiation")
  })

  it("returns null for explicitly unmappable suites", () => {
    expect(mapCatalogSuiteToExolar("admin")).toBeNull()
    expect(mapCatalogSuiteToExolar("my-referral-network-integration")).toBeNull()
  })

  it("returns null for unknown/unrecognized suite slugs (conservative default)", () => {
    expect(mapCatalogSuiteToExolar("some-future-suite")).toBeNull()
  })
})

describe("verdictFromCounts (multi-result aggregation)", () => {
  it("returns failed when any result failed, even amid many passes", () => {
    expect(verdictFromCounts(1, 0, 20)).toBe("failed")
  })

  it("returns timed_out when no failures but a timeout occurred", () => {
    expect(verdictFromCounts(0, 1, 10)).toBe("timed_out")
  })

  it("prioritizes failed over timed_out when both are present", () => {
    expect(verdictFromCounts(1, 1, 10)).toBe("failed")
  })

  it("returns failed when nothing ran (conservative default)", () => {
    expect(verdictFromCounts(0, 0, 0)).toBe("failed")
  })

  it("returns passed when everything ran and nothing failed/timed out", () => {
    expect(verdictFromCounts(0, 0, 15)).toBe("passed")
  })
})

describe("getSuiteVerdictsForCommit", () => {
  it("keeps only the latest execution per suite (dedupes re-runs)", async () => {
    mockSqlRows([
      // Marketplace: latest run (most recent started_at) passed; an older
      // re-run had failed — must be ignored.
      { suite: "Marketplace", started_at: "2026-07-17T12:00:00Z", failed_count: 0, timed_out_count: 0, result_count: 12 },
      { suite: "Marketplace", started_at: "2026-07-17T10:00:00Z", failed_count: 3, timed_out_count: 0, result_count: 12 },
      { suite: "Edit Profile", started_at: "2026-07-17T11:00:00Z", failed_count: 1, timed_out_count: 0, result_count: 5 },
    ])

    const verdicts = await getSuiteVerdictsForCommit(7, "abc123")

    expect(verdicts.get("Marketplace")).toBe("passed")
    expect(verdicts.get("Edit Profile")).toBe("failed")
  })

  it("returns an empty map when no executions exist for the commit", async () => {
    mockSqlRows([])
    const verdicts = await getSuiteVerdictsForCommit(7, "nonexistent-sha")
    expect(verdicts.size).toBe(0)
  })
})

describe("deriveSmartSelectionMetrics", () => {
  it("computes TP/FP/TN/FN across renamed suites", () => {
    const verdicts = new Map([
      ["Marketplace", "failed" as const], // selected, failed -> TP
      ["Negotiation", "passed" as const], // selected, passed -> FP
      ["Edit Profile", "passed" as const], // skipped, passed -> TN
      ["Saved Filters", "timed_out" as const], // skipped, timed_out -> FN
    ])

    const { metrics, unmeasurable } = deriveSmartSelectionMetrics(
      ["marketplace-v2", "negotiation"],
      ["profile", "saved-filters"],
      verdicts,
    )

    expect(metrics).toEqual({
      true_positives: 1,
      false_positives: 1,
      true_negatives: 1,
      false_negatives: 1,
    })
    expect(unmeasurable).toEqual([])
  })

  it("excludes an unmappable suite from counts and reports it unmeasurable (never counted as passing)", () => {
    const verdicts = new Map([["Marketplace", "passed" as const]])

    const { metrics, unmeasurable } = deriveSmartSelectionMetrics(
      ["marketplace-v2"],
      ["admin"], // unmappable, skipped
      verdicts,
    )

    expect(metrics).toEqual({
      true_positives: 0,
      false_positives: 1, // marketplace-v2 selected + passed
      true_negatives: 0, // admin must NOT be counted here
      false_negatives: 0,
    })
    expect(unmeasurable).toEqual([{ suite: "admin", reason: "unmappable_suite" }])
  })

  it("reports a mappable suite with no execution yet as unmeasurable (not counted)", () => {
    const verdicts = new Map<string, "passed" | "failed" | "timed_out">()

    const { metrics, unmeasurable } = deriveSmartSelectionMetrics([], ["negotiation"], verdicts)

    expect(metrics).toEqual({
      true_positives: 0,
      false_positives: 0,
      true_negatives: 0,
      false_negatives: 0,
    })
    expect(unmeasurable).toEqual([{ suite: "negotiation", reason: "no_execution_for_commit" }])
  })
})

describe("getComputedMetricsForDecision", () => {
  const output = {
    selected_suites: ["marketplace-v2"],
    skipped_suites: ["profile"],
  }

  it("returns null metrics (no throw) when no executions exist yet for the commit", async () => {
    mockSqlRows([])

    const result = await getComputedMetricsForDecision(7, "pending-sha", output, null)

    expect(result.source).toBe("none")
    expect(result.metrics).toBeNull()
    expect(result.unmeasurable).toEqual([
      { suite: "marketplace-v2", reason: "no_execution_for_commit" },
      { suite: "profile", reason: "no_execution_for_commit" },
    ])
  })

  it("falls back to a legacy stored blob when no computable join exists", async () => {
    mockSqlRows([])
    const legacy = {
      true_positives: 1,
      false_positives: 0,
      true_negatives: 3,
      false_negatives: 0,
    }

    const result = await getComputedMetricsForDecision(7, "pending-sha", output, legacy)

    expect(result.source).toBe("legacy")
    expect(result.metrics).toEqual(legacy)
    expect(result.unmeasurable).toEqual([])
  })

  it("prefers computed metrics over a stored legacy blob when the join succeeds", async () => {
    mockSqlRows([
      { suite: "Marketplace", started_at: "2026-07-17T12:00:00Z", failed_count: 1, timed_out_count: 0, result_count: 10 },
      { suite: "Edit Profile", started_at: "2026-07-17T12:00:00Z", failed_count: 0, timed_out_count: 0, result_count: 8 },
    ])
    const legacy = {
      true_positives: 0,
      false_positives: 0,
      true_negatives: 0,
      false_negatives: 0,
    }

    const result = await getComputedMetricsForDecision(7, "sha-with-results", output, legacy)

    expect(result.source).toBe("computed")
    expect(result.metrics).toEqual({
      true_positives: 1, // marketplace-v2 selected + failed
      false_positives: 0,
      true_negatives: 1, // profile skipped + passed
      false_negatives: 0,
    })
  })
})
