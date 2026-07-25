import { describe, it, expect } from "vitest"
import { withResolvedDateRange } from "@/lib/mcp/handlers/query"

/**
 * `date_range` was accepted by the schema and advertised to MCP clients, but no
 * handler read it — every "last_24h" query silently returned the full, unscoped
 * result set. These cover the expansion into the `from`/`to` bounds the
 * datasets actually consult.
 */
describe("withResolvedDateRange", () => {
  it("leaves filters untouched when no date_range is given", () => {
    const filters = { limit: 10 }
    expect(withResolvedDateRange(filters)).toEqual(filters)
  })

  it("expands last_24h into a 24-hour from/to window", () => {
    const before = Date.now()
    const out = withResolvedDateRange({ date_range: "last_24h" })
    const after = Date.now()

    expect(out.from).toBeDefined()
    expect(out.to).toBeDefined()

    const from = new Date(out.from!).getTime()
    const to = new Date(out.to!).getTime()

    expect(to).toBeGreaterThanOrEqual(before)
    expect(to).toBeLessThanOrEqual(after)
    expect(to - from).toBe(24 * 60 * 60 * 1000)
  })

  it.each([
    ["last_7d", 7],
    ["last_30d", 30],
    ["last_90d", 90],
  ])("expands %s into a %i-day window", (range, days) => {
    const out = withResolvedDateRange({ date_range: range })
    const span = new Date(out.to!).getTime() - new Date(out.from!).getTime()
    expect(span).toBe(days * 24 * 60 * 60 * 1000)
  })

  it("never overrides an explicit from bound", () => {
    const out = withResolvedDateRange({ date_range: "last_24h", from: "2026-01-01T00:00:00.000Z" })
    expect(out.from).toBe("2026-01-01T00:00:00.000Z")
    expect(out.to).toBeUndefined()
  })

  it("keeps an explicit to bound while deriving from", () => {
    const out = withResolvedDateRange({ date_range: "last_7d", to: "2026-01-10T00:00:00.000Z" })
    expect(out.to).toBe("2026-01-10T00:00:00.000Z")
    expect(out.from).toBeDefined()
  })

  it("ignores an unrecognized date_range instead of inventing a window", () => {
    const filters = { date_range: "last_millennium" }
    expect(withResolvedDateRange(filters)).toEqual(filters)
  })

  it("emits ISO-8601 strings the SQL layer can compare against timestamps", () => {
    const out = withResolvedDateRange({ date_range: "last_30d" })
    expect(out.from).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(out.to).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
})
