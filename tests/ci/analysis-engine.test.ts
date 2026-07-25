import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/connection", () => ({
  getSql: vi.fn(),
}))
vi.mock("@/lib/db/classification", () => ({
  getFailureClassification: vi.fn(),
}))
vi.mock("@/lib/db/clustering", () => ({
  clusterFailures: vi.fn(),
}))

import { getSql } from "@/lib/db/connection"
import { getFailureClassification } from "@/lib/db/classification"
import { clusterFailures } from "@/lib/db/clustering"
import { analyzeExecution } from "@/lib/ci/analysis-engine"

// Mocks `query`, not `unsafe`: in @neondatabase/serverless `sql.unsafe()`
// returns an UnsafeRawSql marker for template interpolation and executes
// nothing, so mocking it as a row-returning executor made these tests pass
// against an API contract the real driver never had.
const mockSql = vi.fn() as ReturnType<typeof vi.fn> & { query: ReturnType<typeof vi.fn> }
mockSql.query = vi.fn()

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    test_signature: "sig::test",
    test_name: "should render button",
    test_file: "tests/button.spec.ts",
    status: "failed",
    retry_count: 0,
    error_message: "Some error",
    stack_trace: null,
    ai_context: null,
    commit_sha: "abc123",
    ...overrides,
  }
}

function makeClassification(overrides: Partial<{
  classification: string
  confidence: number
  flakiness_rate: number
  error_type: string
}> = {}) {
  const {
    classification = "FLAKE",
    confidence = 0.9,
    flakiness_rate = 5,
    error_type = "TimeoutError",
  } = overrides
  return {
    suggested_classification: classification,
    confidence,
    current_failure: { error_type },
    historical_metrics: { flakiness_rate },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(mockSql)
  mockSql.query = vi.fn()
  ;(clusterFailures as ReturnType<typeof vi.fn>).mockResolvedValue([])
})

describe("analyzeExecution — HEALABLE: TimeoutError → wait_adjustment", () => {
  it("classifies TimeoutError FLAKE as HEALABLE with wait_adjustment strategy", async () => {
    mockSql.query.mockResolvedValue([makeRow({ error_message: "Timed out waiting" })])
    ;(getFailureClassification as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeClassification({ classification: "FLAKE", confidence: 0.92, error_type: "TimeoutError" })
    )

    const result = await analyzeExecution(1, 10)

    expect(result.action_plan.healable).toHaveLength(1)
    expect(result.action_plan.healable[0].fix_strategy).toBe("wait_adjustment")
    expect(result.action_plan.healable[0].error_type).toBe("TimeoutError")
  })
})

describe("analyzeExecution — HEALABLE: LocatorError → selector_update", () => {
  it("classifies LocatorError FLAKE as HEALABLE with selector_update strategy", async () => {
    mockSql.query.mockResolvedValue([makeRow({ error_message: "Locator not found" })])
    ;(getFailureClassification as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeClassification({ classification: "FLAKE", confidence: 0.88, error_type: "LocatorError" })
    )

    const result = await analyzeExecution(1, 10)

    expect(result.action_plan.healable).toHaveLength(1)
    expect(result.action_plan.healable[0].fix_strategy).toBe("selector_update")
  })
})

describe("analyzeExecution — REAL_BUG: new failure in commit", () => {
  it("classifies BUG classification as REAL_BUG and adds to bugs via unclustered path", async () => {
    const row = makeRow({ test_name: "login flow fails", error_message: "Assert failed" })
    mockSql.query.mockResolvedValue([row])
    ;(getFailureClassification as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeClassification({ classification: "BUG", confidence: 0.95, error_type: "AssertionError" })
    )
    // clusterFailures returns empty → goes to unclustered bug path
    ;(clusterFailures as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const result = await analyzeExecution(1, 10)

    expect(result.action_plan.bugs).toHaveLength(1)
    expect(result.action_plan.bugs[0].evidence.regression_in_commit).toBe(true)
    expect(result.action_plan.bugs[0].test_signatures).toContain("sig::test")
  })
})

describe("analyzeExecution — KNOWN_FLAKE: high flakiness + passes on retry", () => {
  it("classifies high-flakiness FLAKE that passed on retry as KNOWN_FLAKE", async () => {
    // passed_on_retry is now a DB column (EXISTS subquery) rather than status check
    mockSql.query.mockResolvedValue([
      makeRow({ retry_count: 1, status: "failed", error_message: "Element not attached to the DOM", passed_on_retry: true }),
    ])
    ;(getFailureClassification as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeClassification({ classification: "FLAKE", confidence: 0.85, flakiness_rate: 20, error_type: "StaleElementError" })
    )

    const result = await analyzeExecution(1, 10)

    expect(result.action_plan.known_flakes).toHaveLength(1)
    expect(result.action_plan.known_flakes[0].flakiness_rate).toBe(20)
  })
})

describe("analyzeExecution — INFRA: NetworkError / ECONNREFUSED", () => {
  it("groups NetworkError type failures into infra_issues", async () => {
    mockSql.query.mockResolvedValue([makeRow({ error_message: "fetch failed" })])
    ;(getFailureClassification as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeClassification({ classification: "FLAKE", confidence: 0.9, error_type: "NetworkError" })
    )

    const result = await analyzeExecution(1, 10)

    expect(result.action_plan.infra_issues).toHaveLength(1)
    expect(result.action_plan.infra_issues[0].error_pattern).toBe("NetworkError")
  })

  it("groups ECONNREFUSED message failures into infra_issues", async () => {
    mockSql.query.mockResolvedValue([makeRow({ error_message: "connect ECONNREFUSED 127.0.0.1:5432" })])
    ;(getFailureClassification as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeClassification({ classification: "FLAKE", confidence: 0.9, error_type: "Error" })
    )

    const result = await analyzeExecution(1, 10)

    expect(result.action_plan.infra_issues).toHaveLength(1)
  })
})

describe("analyzeExecution — MANUAL_REVIEW: confidence < 70%", () => {
  it("routes low-confidence failures to manual_review", async () => {
    mockSql.query.mockResolvedValue([makeRow()])
    ;(getFailureClassification as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeClassification({ classification: "FLAKE", confidence: 0.5, error_type: "UnknownError" })
    )

    const result = await analyzeExecution(1, 10)

    expect(result.action_plan.manual_review).toHaveLength(1)
    expect(result.action_plan.manual_review[0].reason).toMatch(/Low classification confidence/i)
  })
})
