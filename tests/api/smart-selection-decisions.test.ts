import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  validateApiKey: vi.fn(),
}))

vi.mock("@/lib/api-keys", () => ({
  validateOrgApiKey: vi.fn(),
  isExolarApiKey: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  insertSmartSelectionDecision: vi.fn(),
}))

import { validateApiKey } from "@/lib/auth"
import { isExolarApiKey } from "@/lib/api-keys"
import { insertSmartSelectionDecision } from "@/lib/db"
import { POST } from "@/app/api/smart-selection-decisions/route"

function makeRequest(body: unknown, authHeader = "Bearer legacy-test-key") {
  return new Request("http://localhost/api/smart-selection-decisions", {
    method: "POST",
    headers: { authorization: authHeader, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

// Legacy full payload — classic CI client with confidence, metrics, actual_run.
const fullPayload = {
  pr_number: 42,
  repository: "attorneyshare/attorney_share_mvp_web",
  base_sha: "base123",
  head_sha: "head456",
  author: "octocat",
  mode: "active",
  model: "google/gemini-2.5-flash-lite",
  system_prompt_hash: "abcd1234ef56",
  input: {
    file_count: 12,
    sanitized_token_count: 3400,
    dropped_paths_count: 2,
  },
  output: {
    selected_suites: ["referrals.spec.ts"],
    skipped_suites: ["billing.spec.ts"],
    confidence: 0.87,
    observation: "Changes confined to referrals module.",
    uncertainty_flags: [],
  },
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
  timing: {
    inference_latency_ms: 850,
    input_tokens: 1200,
    output_tokens: 90,
  },
}

// Decision-only payload — Eve agent client, ENG-1434.
const decisionOnlyPayload = {
  pr_number: 42,
  repository: "attorneyshare/attorney_share_mvp_web",
  base_sha: "base123",
  head_sha: "head789",
  author: "eve-agent",
  mode: "shadow",
  model: "eve-agent-v1",
  system_prompt_hash: "abcd1234ef56",
  input: {
    file_count: 12,
  },
  output: {
    selected_suites: ["referrals.spec.ts"],
    skipped_suites: ["billing.spec.ts"],
    confidence: null,
    observation: "Changes confined to referrals module.",
    uncertainty_flags: [],
  },
  timing: {
    inference_latency_ms: 850,
    input_tokens: 1200,
    output_tokens: 90,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(validateApiKey as ReturnType<typeof vi.fn>).mockReturnValue(true)
  ;(isExolarApiKey as ReturnType<typeof vi.fn>).mockReturnValue(false)
  ;(insertSmartSelectionDecision as ReturnType<typeof vi.fn>).mockResolvedValue({
    event_id: "1",
  })
})

describe("POST /api/smart-selection-decisions", () => {
  it("accepts a decision-only payload (confidence:null, no metrics/actual_run) and stores it", async () => {
    const response = await POST(makeRequest(decisionOnlyPayload))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ success: true, event_id: "1" })

    expect(insertSmartSelectionDecision).toHaveBeenCalledTimes(1)
    const storedRecord = (insertSmartSelectionDecision as ReturnType<typeof vi.fn>).mock
      .calls[0][0]
    expect(storedRecord.output.confidence).toBeNull()
    expect(storedRecord.actual_run).toBeUndefined()
    expect(storedRecord.metrics).toBeUndefined()
  })

  it("still accepts a legacy full payload with confidence + metrics + actual_run", async () => {
    const response = await POST(makeRequest(fullPayload))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ success: true, event_id: "1" })

    expect(insertSmartSelectionDecision).toHaveBeenCalledTimes(1)
    const storedRecord = (insertSmartSelectionDecision as ReturnType<typeof vi.fn>).mock
      .calls[0][0]
    expect(storedRecord.output.confidence).toBe(0.87)
    expect(storedRecord.actual_run).toEqual(fullPayload.actual_run)
    expect(storedRecord.metrics).toEqual(fullPayload.metrics)
  })

  it("rejects a malformed payload missing repository/selected_suites with 400", async () => {
    const malformed = {
      ...decisionOnlyPayload,
      repository: undefined,
      output: {
        ...decisionOnlyPayload.output,
        selected_suites: undefined,
      },
    }

    const response = await POST(makeRequest(malformed))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error).toMatch(/Invalid payload/)
    expect(insertSmartSelectionDecision).not.toHaveBeenCalled()
  })

  it("rejects requests without a valid API key", async () => {
    ;(validateApiKey as ReturnType<typeof vi.fn>).mockReturnValue(false)

    const response = await POST(makeRequest(decisionOnlyPayload, "Bearer nope"))
    expect(response.status).toBe(401)
    expect(insertSmartSelectionDecision).not.toHaveBeenCalled()
  })
})
