import { describe, it, expect, vi, beforeEach } from "vitest"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

import {
  fetchLinearTicket,
  isTicketWIP,
  formatLinearContext,
  type LinearTicketContext,
} from "@/lib/ci/linear-context"

function makeTicket(overrides: Partial<LinearTicketContext> = {}): LinearTicketContext {
  return {
    id: "abc-1",
    identifier: "ENG-123",
    title: "Fix login button",
    description: "Button is broken",
    state: "In Progress",
    priority: 2,
    labels: ["bug"],
    assignee: "Alice",
    url: "https://linear.app/team/issue/ENG-123",
    ...overrides,
  }
}

function makeLinearApiResponse(issue: Record<string, unknown> | null) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        issueSearch: {
          nodes: issue ? [issue] : [],
        },
      },
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.LINEAR_API_KEY
})

describe("fetchLinearTicket — no API key", () => {
  it("returns null when LINEAR_API_KEY is not set", async () => {
    const result = await fetchLinearTicket("ENG-123")
    expect(result).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe("fetchLinearTicket — successful response", () => {
  beforeEach(() => {
    process.env.LINEAR_API_KEY = "lin_api_test"
  })

  it("parses a full Linear GraphQL response correctly", async () => {
    mockFetch.mockResolvedValue(
      makeLinearApiResponse({
        id: "abc-1",
        identifier: "ENG-123",
        title: "Fix login button",
        description: "Button is broken",
        state: { name: "In Progress" },
        priority: 2,
        labels: { nodes: [{ name: "bug" }, { name: "frontend" }] },
        assignee: { name: "Alice" },
        url: "https://linear.app/team/issue/ENG-123",
      })
    )

    const result = await fetchLinearTicket("ENG-123")

    expect(result).not.toBeNull()
    expect(result?.identifier).toBe("ENG-123")
    expect(result?.title).toBe("Fix login button")
    expect(result?.state).toBe("In Progress")
    expect(result?.priority).toBe(2)
    expect(result?.labels).toEqual(["bug", "frontend"])
    expect(result?.assignee).toBe("Alice")
  })

  it("returns null when issue is not found in response", async () => {
    mockFetch.mockResolvedValue(makeLinearApiResponse(null))

    const result = await fetchLinearTicket("ENG-999")
    expect(result).toBeNull()
  })

  it("returns null when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"))

    const result = await fetchLinearTicket("ENG-123")
    expect(result).toBeNull()
  })

  it("returns null when response is not ok", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })

    const result = await fetchLinearTicket("ENG-123")
    expect(result).toBeNull()
  })
})

describe("isTicketWIP", () => {
  it("returns true for 'In Progress' state", () => {
    expect(isTicketWIP(makeTicket({ state: "In Progress" }))).toBe(true)
  })

  it("returns true for 'In Review' state", () => {
    expect(isTicketWIP(makeTicket({ state: "In Review" }))).toBe(true)
  })

  it("returns false for 'Backlog' state (not actively in progress)", () => {
    expect(isTicketWIP(makeTicket({ state: "Backlog" }))).toBe(false)
  })

  it("returns false for 'Unstarted' state (not actively in progress)", () => {
    expect(isTicketWIP(makeTicket({ state: "Unstarted" }))).toBe(false)
  })

  it("returns false for 'Done' state", () => {
    expect(isTicketWIP(makeTicket({ state: "Done" }))).toBe(false)
  })

  it("returns false for 'Cancelled' state", () => {
    expect(isTicketWIP(makeTicket({ state: "Cancelled" }))).toBe(false)
  })
})

describe("formatLinearContext", () => {
  it("produces markdown with identifier, title, status, priority, assignee and labels", () => {
    const ticket = makeTicket()
    const output = formatLinearContext(ticket)

    expect(output).toContain("### Linear Ticket")
    expect(output).toContain("[ENG-123]")
    expect(output).toContain("Fix login button")
    expect(output).toContain("**Status**: In Progress")
    expect(output).toContain("**Priority**: High")
    expect(output).toContain("**Assignee**: Alice")
    expect(output).toContain("**Labels**: bug")
  })

  it("omits Assignee line when assignee is null", () => {
    const output = formatLinearContext(makeTicket({ assignee: null }))
    expect(output).not.toContain("**Assignee**")
  })

  it("omits Labels line when labels array is empty", () => {
    const output = formatLinearContext(makeTicket({ labels: [] }))
    expect(output).not.toContain("**Labels**")
  })

  it("maps priority 1 to Urgent and priority 0 to No priority", () => {
    expect(formatLinearContext(makeTicket({ priority: 1 }))).toContain("Urgent")
    expect(formatLinearContext(makeTicket({ priority: 0 }))).toContain("No priority")
  })
})
