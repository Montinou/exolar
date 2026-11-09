import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/connection", () => ({
  getSql: vi.fn(),
}))

vi.mock("@/lib/db/flakiness", () => ({
  updateFlakinessHistory: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/db/suites", () => ({
  detectTechStack: vi.fn(),
  upsertSuite: vi.fn(),
  upsertSuiteTest: vi.fn().mockResolvedValue(undefined),
  updateSuiteTestCounts: vi.fn().mockResolvedValue(undefined),
  markInactiveTests: vi.fn().mockResolvedValue(0),
}))

import { getSql } from "@/lib/db/connection"
import { markInactiveTests, updateSuiteTestCounts } from "@/lib/db/suites"
import { insertTestResults } from "@/lib/db/ingestion"
import type { TestResultRequest } from "@/lib/types"

const ORG_ID = 7
const EXECUTION_ID = 99

const results: TestResultRequest[] = [
  {
    test_name: "creates a referral",
    test_file: "referrals.spec.ts",
    status: "passed",
    duration_ms: 1200,
  } as TestResultRequest,
]

// The batch INSERT ... RETURNING is the only sql`` call the ingestion makes
// itself; echo one row back so the signature map is populated.
function mockInsertReturning() {
  const sqlTag = vi.fn().mockResolvedValue([
    { id: 1, test_signature: "sig-1", retry_count: 0 },
  ])
  ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(markInactiveTests as ReturnType<typeof vi.fn>).mockResolvedValue(0)
  ;(updateSuiteTestCounts as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  mockInsertReturning()
})

describe("insertTestResults inactive-test housekeeping (ENG-2275)", () => {
  it("calls markInactiveTests with the organization id before updateSuiteTestCounts when a suiteId is given", async () => {
    await insertTestResults(ORG_ID, EXECUTION_ID, results, 5)

    expect(markInactiveTests).toHaveBeenCalledTimes(1)
    expect(markInactiveTests).toHaveBeenCalledWith(ORG_ID)
    expect(updateSuiteTestCounts).toHaveBeenCalledWith(ORG_ID)

    const markOrder = (markInactiveTests as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0]
    const countsOrder = (updateSuiteTestCounts as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0]
    expect(markOrder).toBeLessThan(countsOrder)
  })

  it("also calls markInactiveTests when no suiteId is given", async () => {
    await insertTestResults(ORG_ID, EXECUTION_ID, results)

    expect(markInactiveTests).toHaveBeenCalledTimes(1)
    expect(markInactiveTests).toHaveBeenCalledWith(ORG_ID)
    expect(updateSuiteTestCounts).not.toHaveBeenCalled()
  })

  it("still resolves with the signature map and logs the error when markInactiveTests rejects", async () => {
    const failure = new Error("db down")
    ;(markInactiveTests as ReturnType<typeof vi.fn>).mockRejectedValue(failure)
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const map = await insertTestResults(ORG_ID, EXECUTION_ID, results, 5)

    expect(map).toBeInstanceOf(Map)
    expect(map.get("sig-1")).toBe(1)
    expect(errorSpy).toHaveBeenCalledWith(
      "[ingestion] markInactiveTests failed",
      failure
    )
    // Counts still refreshed after the housekeeping failure.
    expect(updateSuiteTestCounts).toHaveBeenCalledWith(ORG_ID)

    errorSpy.mockRestore()
  })
})
