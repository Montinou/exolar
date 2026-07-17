import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  listSmartSelectionDecisions: vi.fn(),
  getComputedMetricsForDecision: vi.fn(),
}))

import { listSmartSelectionDecisions, getComputedMetricsForDecision } from "@/lib/db"
import { handleQuery } from "@/lib/mcp/handlers/query"
import type { MCPAuthContext } from "@/lib/mcp/auth"

const authContext: MCPAuthContext = {
  userId: 1,
  email: "qa@attorneyshare.com",
  organizationId: 7,
  organizationSlug: "attorneyshare",
  orgRole: "owner",
  userRole: "admin",
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("query_exolar_data: smart_selection_decisions", () => {
  it("renders a decision-only row (null confidence, no stored metrics) without crashing", async () => {
    ;(listSmartSelectionDecisions as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 1,
        pr_number: 42,
        mode: "shadow",
        head_sha: "head789",
        output: {
          selected_suites: ["marketplace-v2"],
          skipped_suites: ["admin"],
          confidence: null,
          observation: "",
          uncertainty_flags: [],
        },
        metrics: undefined,
      },
    ])
    ;(getComputedMetricsForDecision as ReturnType<typeof vi.fn>).mockResolvedValue({
      metrics: { true_positives: 1, false_positives: 0, true_negatives: 0, false_negatives: 0 },
      unmeasurable: [{ suite: "admin", reason: "unmappable_suite" }],
      source: "computed",
    })

    const result = await handleQuery(
      { dataset: "smart_selection_decisions", format: "markdown" },
      authContext,
    )

    expect(result.isError).toBeUndefined()
    const text = result.content[0].text
    expect(text).toContain("—") // confidence rendered as em-dash, not a crash
    expect(text).toContain("#42")
    expect(text).not.toMatch(/undefined|NaN/)
  })

  it("still renders a legacy full row (numeric confidence, computed metrics available)", async () => {
    ;(listSmartSelectionDecisions as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 2,
        pr_number: 10,
        mode: "active",
        head_sha: "legacyhead",
        output: {
          selected_suites: ["negotiation"],
          skipped_suites: ["profile"],
          confidence: 0.87,
          observation: "",
          uncertainty_flags: [],
        },
        metrics: {
          true_positives: 1,
          false_positives: 0,
          true_negatives: 3,
          false_negatives: 0,
        },
      },
    ])
    ;(getComputedMetricsForDecision as ReturnType<typeof vi.fn>).mockResolvedValue({
      metrics: { true_positives: 1, false_positives: 0, true_negatives: 3, false_negatives: 0 },
      unmeasurable: [],
      source: "legacy",
    })

    const result = await handleQuery(
      { dataset: "smart_selection_decisions", format: "markdown" },
      authContext,
    )

    expect(result.isError).toBeUndefined()
    const text = result.content[0].text
    expect(text).toContain("#10")
    expect(text).toContain("0.87")
  })

  it("does not crash and reports no measurable suites when the commit has no executions yet", async () => {
    ;(listSmartSelectionDecisions as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 3,
        pr_number: 99,
        mode: "shadow",
        head_sha: "pending-sha",
        output: {
          selected_suites: ["negotiation"],
          skipped_suites: ["signin"],
          confidence: null,
          observation: "",
          uncertainty_flags: [],
        },
        metrics: undefined,
      },
    ])
    ;(getComputedMetricsForDecision as ReturnType<typeof vi.fn>).mockResolvedValue({
      metrics: null,
      unmeasurable: [
        { suite: "negotiation", reason: "no_execution_for_commit" },
        { suite: "signin", reason: "no_execution_for_commit" },
      ],
      source: "none",
    })

    const result = await handleQuery(
      { dataset: "smart_selection_decisions", format: "markdown" },
      authContext,
    )

    expect(result.isError).toBeUndefined()
    const text = result.content[0].text
    expect(text).toContain("#99")
    expect(text).not.toMatch(/undefined|NaN/)
  })
})
