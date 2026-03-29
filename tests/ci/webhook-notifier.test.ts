import { describe, it, expect, vi, beforeEach } from "vitest"
import { createHmac } from "crypto"

vi.mock("@/lib/db/connection", () => ({
  getSql: vi.fn(),
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

import { getSql } from "@/lib/db/connection"
import { notifyWebhooks } from "@/lib/ci/webhook-notifier"
import type { WebhookPayload } from "@/lib/ci/webhook-notifier"

const basePayload: WebhookPayload = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: ("ci." + "failure") as WebhookPayload["event"],
  execution_id: 42,
  organization_id: 7,
  run_id: "run-001",
  branch: "main",
  failure_count: 3,
  total_tests: 100,
  timestamp: "2026-03-29T00:00:00Z",
}

// Builds a webhook DB row matching the WebhookConfig shape:
// The SQL query aliases secret_hash AS secret, so the field is "secret"
function makeWebhook(overrides: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = {
    id: 1,
    url: "https://example.com/hook",
    filters: {},
    secret: null,
  }
  row["events"] = [basePayload.event]
  Object.assign(row, overrides)
  return row
}

beforeEach(() => {
  vi.clearAllMocks()
  const sqlTag = vi.fn().mockResolvedValue([])
  ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)
  mockFetch.mockResolvedValue({ ok: true, status: 200 })
})

describe("matchesFilters — min_failures filter", () => {
  it("sends to webhook when failure_count meets min_failures", async () => {
    const sqlTag = vi.fn().mockResolvedValue([makeWebhook({ filters: { min_failures: 2 } })])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    await notifyWebhooks({ ...basePayload, failure_count: 3 })

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("skips webhook when failure_count is below min_failures", async () => {
    const sqlTag = vi.fn().mockResolvedValue([makeWebhook({ filters: { min_failures: 5 } })])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    await notifyWebhooks({ ...basePayload, failure_count: 3 })

    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe("matchesFilters — branches filter", () => {
  it("sends to webhook when branch is in the allowed list", async () => {
    const sqlTag = vi.fn().mockResolvedValue([makeWebhook({ filters: { branches: ["main", "staging"] } })])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    await notifyWebhooks({ ...basePayload, branch: "main" })

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("skips webhook when branch is not in the allowed list", async () => {
    const sqlTag = vi.fn().mockResolvedValue([makeWebhook({ filters: { branches: ["staging"] } })])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    await notifyWebhooks({ ...basePayload, branch: "feature/xyz" })

    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe("signPayload — HMAC-SHA256", () => {
  it("includes X-Exolar-Signature header with sha256= prefix when secret is set", async () => {
    const secret = "mysecret"
    // The SQL query aliases secret_hash AS secret; source reads wh.secret
    const webhookRow = makeWebhook({ secret: secret })
    const sqlTag = vi.fn().mockResolvedValue([webhookRow])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    await notifyWebhooks(basePayload)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]
    const headers = callArgs[1].headers as Record<string, string>
    const body = callArgs[1].body as string

    // Verify the signature is present and correctly computed from the body
    const sigHeader = headers["X-Exolar-Signature"]
    expect(sigHeader).toBeDefined()
    expect(sigHeader).toMatch(/^sha256=/)
    // Recompute expected sig from the actual body sent
    const expectedSig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex")
    expect(sigHeader).toBe(expectedSig)
  })

  it("does not include X-Exolar-Signature header when secret is null", async () => {
    const sqlTag = vi.fn().mockResolvedValue([makeWebhook()])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    await notifyWebhooks(basePayload)

    const callArgs = mockFetch.mock.calls[0]
    const headers = callArgs[1].headers as Record<string, string>
    expect(headers["X-Exolar-Signature"]).toBeUndefined()
  })
})

describe("notifyWebhooks — delivery", () => {
  it("sends to all matching webhooks", async () => {
    const sqlTag = vi.fn().mockResolvedValue([
      makeWebhook({ id: 1, url: "https://a.com/hook" }),
      makeWebhook({ id: 2, url: "https://b.com/hook" }),
    ])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    await notifyWebhooks(basePayload)

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("returns early and does not call fetch when no webhooks configured", async () => {
    const sqlTag = vi.fn().mockResolvedValue([])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    await notifyWebhooks(basePayload)

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("sets Content-Type and X-Exolar-Event headers on every delivery", async () => {
    const sqlTag = vi.fn().mockResolvedValue([makeWebhook()])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    await notifyWebhooks(basePayload)

    const callArgs = mockFetch.mock.calls[0]
    const headers = callArgs[1].headers as Record<string, string>
    expect(headers["Content-Type"]).toBe("application/json")
    // X-Exolar-Event reflects payload.event value ("ci.failure")
    expect(headers["X-Exolar-Event"]).toBe(basePayload.event)
  })
})
