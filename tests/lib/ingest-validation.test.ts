import { describe, expect, it } from "vitest"
import { validateIngestRequest } from "@/lib/validation"

// Zod strips unknown keys instead of rejecting them, so a field missing from
// artifactSchema disappears silently between the reporter and the R2 key —
// the exact failure mode that let every retry overwrite the same object.
describe("validateIngestRequest artifacts", () => {
  const payload = (artifact: Record<string, unknown>) => ({
    execution: {
      run_id: "30492951667",
      branch: "main",
      commit_sha: "af30809d5703e19a58e0a4b007bdc9cde3a8085a",
      status: "failure",
      total_tests: 1,
      passed: 0,
      failed: 1,
      skipped: 0,
      started_at: "2026-07-29T21:50:23.573Z",
    },
    results: [
      {
        test_name: "should remove member via UI",
        test_file: "my-referral-network/crud-operations.spec.ts",
        status: "failed",
        duration_ms: 1000,
      },
    ],
    artifacts: [artifact],
  })

  const base = {
    test_name: "should remove member via UI",
    test_file: "my-referral-network/crud-operations.spec.ts",
    type: "screenshot",
    filename: "screenshot",
    data: "eA==",
  }

  it("keeps retry_count so the artifact can be tied to its attempt", () => {
    const result = validateIngestRequest(payload({ ...base, retry_count: 2 }))

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.artifacts[0].retry_count).toBe(2)
  })

  it("accepts an artifact with no retry_count", () => {
    const result = validateIngestRequest(payload(base))

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.artifacts[0].retry_count).toBeUndefined()
  })
})
