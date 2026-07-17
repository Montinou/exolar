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
  getRecentFalseNegativeStats,
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

  it("prioritizes timed_out over failed when both are present (mirrors CI's classify(), timeout wins)", () => {
    expect(verdictFromCounts(1, 1, 10)).toBe("timed_out")
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

  it("treats an all-skipped suite as 'nothing ran' -> failed (CI excludes declared-skip tests from result_count)", async () => {
    // Every test_results row for this execution is status='skipped'; the SQL
    // excludes skipped rows from result_count (COUNT(tr.id) FILTER (WHERE
    // tr.status <> 'skipped')), so this must resolve like "nothing ran"
    // rather than silently passing.
    mockSqlRows([
      { suite: "Negotiation", started_at: "2026-07-17T12:00:00Z", failed_count: 0, timed_out_count: 0, result_count: 0 },
    ])

    const verdicts = await getSuiteVerdictsForCommit(7, "all-skipped-sha")
    expect(verdicts.get("Negotiation")).toBe("failed")
  })
})

describe("getSuiteVerdictsForCommit — hybrid join keys (ENG-1434 join-key fix)", () => {
  // ENG-1434 cross-repo review: test_executions.commit_sha is populated from
  // the PR's MERGE commit, not head_sha, so head_sha-only joins never match.
  // These cover the hybrid PRIMARY (merge_commit_sha/head_sha) + FALLBACK
  // (branch) behavior added to close that gap.

  it("matches PRIMARY via merge_commit_sha when head_sha alone would never match", async () => {
    mockSqlRows([
      {
        suite: "Marketplace",
        started_at: "2026-07-17T12:00:00Z",
        failed_count: 1,
        timed_out_count: 0,
        result_count: 10,
      },
    ])

    const verdicts = await getSuiteVerdictsForCommit(7, "pr-head-sha-never-stored", {
      mergeCommitSha: "merge-sha-that-is-actually-stored",
    })

    expect(verdicts.get("Marketplace")).toBe("failed")
  })

  it("falls back to a branch match (latest execution per suite) when neither sha matches", async () => {
    const sqlTag = vi.fn()
    sqlTag.mockResolvedValueOnce([]) // PRIMARY: no rows for either sha
    sqlTag.mockResolvedValueOnce([
      // FALLBACK by branch: latest run passed; an older run on the same
      // branch had failed and must be ignored.
      {
        suite: "Marketplace",
        started_at: "2026-07-17T12:00:00Z",
        failed_count: 0,
        timed_out_count: 0,
        result_count: 10,
      },
      {
        suite: "Marketplace",
        started_at: "2026-07-17T09:00:00Z",
        failed_count: 1,
        timed_out_count: 0,
        result_count: 10,
      },
    ])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    const verdicts = await getSuiteVerdictsForCommit(7, "unmatched-head-sha", {
      mergeCommitSha: "unmatched-merge-sha",
      branch: "feat/some-branch",
    })

    expect(sqlTag).toHaveBeenCalledTimes(2)
    expect(verdicts.get("Marketplace")).toBe("passed")
  })

  it("returns an empty map (no throw) when neither sha nor branch matches anything", async () => {
    const sqlTag = vi.fn()
    sqlTag.mockResolvedValueOnce([]) // PRIMARY
    sqlTag.mockResolvedValueOnce([]) // FALLBACK
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    const verdicts = await getSuiteVerdictsForCommit(7, "no-match-sha", {
      mergeCommitSha: "no-match-merge-sha",
      branch: "no-match-branch",
    })

    expect(verdicts.size).toBe(0)
  })

  it("does not attempt a branch fallback query when no branch is available", async () => {
    const sqlTag = vi.fn()
    sqlTag.mockResolvedValueOnce([]) // PRIMARY only
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    const verdicts = await getSuiteVerdictsForCommit(7, "no-match-sha")

    expect(sqlTag).toHaveBeenCalledTimes(1)
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

  it("computes metrics via the PRIMARY path when head_sha differs from executions but merge_commit_sha matches", async () => {
    mockSqlRows([
      { suite: "Marketplace", started_at: "2026-07-17T12:00:00Z", failed_count: 1, timed_out_count: 0, result_count: 10 },
      { suite: "Edit Profile", started_at: "2026-07-17T12:00:00Z", failed_count: 0, timed_out_count: 0, result_count: 8 },
    ])

    const result = await getComputedMetricsForDecision(
      7,
      "pr-head-sha-never-stored",
      output,
      null,
      { mergeCommitSha: "merge-sha-that-is-actually-stored" },
    )

    expect(result.source).toBe("computed")
    expect(result.metrics).toEqual({
      true_positives: 1,
      false_positives: 0,
      true_negatives: 1,
      false_negatives: 0,
    })
  })

  it("computes metrics via the branch FALLBACK when no sha (head or merge_commit) matches anything", async () => {
    const sqlTag = vi.fn()
    sqlTag.mockResolvedValueOnce([]) // PRIMARY: no sha match
    sqlTag.mockResolvedValueOnce([
      { suite: "Marketplace", started_at: "2026-07-17T12:00:00Z", failed_count: 1, timed_out_count: 0, result_count: 10 },
      { suite: "Edit Profile", started_at: "2026-07-17T12:00:00Z", failed_count: 0, timed_out_count: 0, result_count: 8 },
    ])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    const result = await getComputedMetricsForDecision(
      7,
      "unmatched-head-sha",
      output,
      null,
      { mergeCommitSha: "unmatched-merge-sha", branch: "feat/some-branch" },
    )

    expect(result.source).toBe("computed")
    expect(result.metrics).toEqual({
      true_positives: 1,
      false_positives: 0,
      true_negatives: 1,
      false_negatives: 0,
    })
  })

  it("still returns null without throwing when neither sha nor branch matches anything at all", async () => {
    const sqlTag = vi.fn()
    sqlTag.mockResolvedValueOnce([]) // PRIMARY
    sqlTag.mockResolvedValueOnce([]) // FALLBACK
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    const result = await getComputedMetricsForDecision(
      7,
      "no-match-sha",
      output,
      null,
      { mergeCommitSha: "no-match-merge-sha", branch: "no-match-branch" },
    )

    expect(result.source).toBe("none")
    expect(result.metrics).toBeNull()
  })
})

describe("getRecentFalseNegativeStats (circuit-breaker, computed join)", () => {
  it("counts a computed false-negative from a decision-only row (metrics NULL) via the join", async () => {
    // Decision-only row (Eve agent): stored `metrics` is NULL, so a naive
    // SQL-side (metrics->>'false_negatives')::int filter would never count
    // this row. The FN must come from computing the join instead.
    const sqlTag = vi.fn()
    sqlTag.mockResolvedValueOnce([
      {
        mode: "active",
        head_sha: "shaX",
        output: { selected_suites: ["marketplace-v2"], skipped_suites: ["negotiation"] },
        metrics: null,
      },
    ])
    sqlTag.mockResolvedValueOnce([
      { suite: "Marketplace", started_at: "2026-07-17T12:00:00Z", failed_count: 0, timed_out_count: 0, result_count: 5 },
      { suite: "Negotiation", started_at: "2026-07-17T12:00:00Z", failed_count: 1, timed_out_count: 0, result_count: 5 },
    ])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    const stats = await getRecentFalseNegativeStats(7, 7)

    expect(stats.total_active_decisions).toBe(1)
    expect(stats.active_false_negatives).toBe(1) // negotiation skipped + failed -> FN
    expect(stats.shadow_decisions_count).toBe(0)
    expect(stats.shadow_false_negatives).toBe(0)
  })

  it("does not count a decision with no false negatives, even in shadow mode", async () => {
    const sqlTag = vi.fn()
    sqlTag.mockResolvedValueOnce([
      {
        mode: "shadow",
        head_sha: "shaY",
        output: { selected_suites: ["marketplace-v2"], skipped_suites: ["negotiation"] },
        metrics: null,
      },
    ])
    sqlTag.mockResolvedValueOnce([
      { suite: "Marketplace", started_at: "2026-07-17T12:00:00Z", failed_count: 1, timed_out_count: 0, result_count: 5 },
      { suite: "Negotiation", started_at: "2026-07-17T12:00:00Z", failed_count: 0, timed_out_count: 0, result_count: 5 },
    ])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    const stats = await getRecentFalseNegativeStats(7, 7)

    expect(stats.shadow_decisions_count).toBe(1)
    expect(stats.shadow_false_negatives).toBe(0)
    expect(stats.total_active_decisions).toBe(0)
  })
})
