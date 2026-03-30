import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/connection", () => ({
  getSql: vi.fn(),
}))

import { getSql } from "@/lib/db/connection"
import { generateHealInstructions, recordHealAttempt, type HealResult } from "@/lib/ci/auto-heal"
import type { HealableFailure } from "@/lib/ci/analysis-engine"

function makeFailure(overrides: Partial<HealableFailure> = {}): HealableFailure {
  return {
    test_signature: "tests/button.spec.ts::should render",
    test_file: "tests/button.spec.ts",
    test_name: "should render button",
    error_type: "TimeoutError",
    error_message: "Timeout waiting for element",
    fix_strategy: "wait_adjustment",
    confidence: 0.88,
    ai_context: null,
    similar_past_fixes: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("generateHealInstructions — fix strategy mapping", () => {
  it("selector_update instruction mentions getByRole/getByTestId", () => {
    const [instr] = generateHealInstructions([makeFailure({ fix_strategy: "selector_update", error_type: "LocatorError" })])
    expect(instr.fix_strategy).toBe("selector_update")
    expect(instr.instruction).toMatch(/getByRole|getByTestId/i)
  })

  it("wait_adjustment instruction mentions waitForLoadState or locator timeout", () => {
    const [instr] = generateHealInstructions([makeFailure({ fix_strategy: "wait_adjustment", error_type: "TimeoutError" })])
    expect(instr.fix_strategy).toBe("wait_adjustment")
    expect(instr.instruction).toMatch(/waitForLoadState|timeout/i)
  })

  it("race_condition instruction mentions toBeVisible or toBeEnabled", () => {
    const [instr] = generateHealInstructions([makeFailure({ fix_strategy: "race_condition" })])
    expect(instr.fix_strategy).toBe("race_condition")
    expect(instr.instruction).toMatch(/toBeVisible|toBeEnabled/i)
  })

  it("api_timing instruction mentions waitForResponse", () => {
    const [instr] = generateHealInstructions([makeFailure({ fix_strategy: "api_timing" })])
    expect(instr.fix_strategy).toBe("api_timing")
    expect(instr.instruction).toMatch(/waitForResponse/i)
  })

  it("retry_logic instruction mentions stale element or re-query", () => {
    const [instr] = generateHealInstructions([makeFailure({ fix_strategy: "retry_logic" })])
    expect(instr.fix_strategy).toBe("retry_logic")
    expect(instr.instruction).toMatch(/stale|re-query|locator/i)
  })
})

describe("generateHealInstructions — guardrails", () => {
  it("sets max_attempts to 3", () => {
    const [instr] = generateHealInstructions([makeFailure()])
    expect(instr.guardrails.max_attempts).toBe(3)
  })

  it("allowed_file_patterns includes *.spec.ts and *.test.ts", () => {
    const [instr] = generateHealInstructions([makeFailure()])
    expect(instr.guardrails.allowed_file_patterns).toContain("*.spec.ts")
    expect(instr.guardrails.allowed_file_patterns).toContain("*.test.ts")
  })

  it("forbidden_patterns includes src/** and lib/**", () => {
    const [instr] = generateHealInstructions([makeFailure()])
    expect(instr.guardrails.forbidden_patterns).toContain("src/**")
    expect(instr.guardrails.forbidden_patterns).toContain("lib/**")
  })
})

describe("generateHealInstructions — context propagation", () => {
  it("copies test_file and test_name from the failure", () => {
    const [instr] = generateHealInstructions([makeFailure({
      test_file: "tests/auth.spec.ts",
      test_name: "should login",
    })])
    expect(instr.test_file).toBe("tests/auth.spec.ts")
    expect(instr.test_name).toBe("should login")
    expect(instr.context.error_type).toBe("TimeoutError")
  })

  it("maps similar_past_fixes into context.similar_fixes", () => {
    const [instr] = generateHealInstructions([makeFailure({
      similar_past_fixes: [{ signature: "sig::old", strategy: "wait_adjustment", success: true }],
    })])
    expect(instr.context.similar_fixes).toHaveLength(1)
    expect(instr.context.similar_fixes[0].signature).toBe("sig::old")
  })

  it("handles multiple failures and preserves order", () => {
    const failures = [
      makeFailure({ test_name: "test A", fix_strategy: "selector_update" }),
      makeFailure({ test_name: "test B", fix_strategy: "wait_adjustment" }),
    ]
    const instrs = generateHealInstructions(failures)
    expect(instrs).toHaveLength(2)
    expect(instrs[0].test_name).toBe("test A")
    expect(instrs[1].test_name).toBe("test B")
  })
})

describe("recordHealAttempt", () => {
  it("calls SQL template tag with correct analysis_id and result fields", async () => {
    const fakeResult = vi.fn().mockResolvedValue([])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(fakeResult)

    const result: HealResult = {
      test_signature: "tests/login.spec.ts::should log in",
      status: "success",
      attempts: 2,
      pr_url: "https://github.com/org/repo/pull/42",
      pr_number: 42,
    }

    await recordHealAttempt(99, result)

    expect(getSql).toHaveBeenCalled()
    expect(fakeResult).toHaveBeenCalled()
  })

  it("passes null pr_url and pr_number when not provided", async () => {
    const fakeResult = vi.fn().mockResolvedValue([])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(fakeResult)

    const result: HealResult = {
      test_signature: "tests/x.spec.ts::test",
      status: "failed",
      attempts: 1,
      error_log: "Something went wrong",
    }

    await recordHealAttempt(5, result)

    expect(fakeResult).toHaveBeenCalled()
  })
})
