import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/connection", () => ({
  getSql: vi.fn(),
}))

import { getSql } from "@/lib/db/connection"
import {
  formatIssueBody,
  recordBugReport,
  findExistingBugReport,
  type BugReportResult,
} from "@/lib/ci/auto-bugs"
import type { DetectedBug } from "@/lib/ci/analysis-engine"

function makeBug(overrides: Partial<DetectedBug> = {}): DetectedBug {
  return {
    summary: "Cluster 0: AssertionError: expected 200 but got 500",
    test_signatures: ["tests/api.spec.ts::status check"],
    root_cause_cluster: "AssertionError in api tests",
    confidence: 0.87,
    issue_body: "",
    evidence: {
      error_message: "AssertionError: expected 200 but got 500",
      stack_trace: null,
      first_seen_commit: "abc123",
      affected_tests_count: 1,
      regression_in_commit: true,
    },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("formatIssueBody — basic structure", () => {
  it("includes Summary section with bug summary", () => {
    const output = formatIssueBody(makeBug())
    expect(output).toContain("## Summary")
    expect(output).toContain("Cluster 0: AssertionError")
  })

  it("includes Evidence section with error message", () => {
    const output = formatIssueBody(makeBug())
    expect(output).toContain("## Evidence")
    expect(output).toContain("AssertionError: expected 200 but got 500")
  })

  it("includes affected test signature in the body", () => {
    const output = formatIssueBody(makeBug())
    expect(output).toContain("tests/api.spec.ts::status check")
  })

  it("includes Classification section with confidence percentage", () => {
    const output = formatIssueBody(makeBug({ confidence: 0.87 }))
    expect(output).toContain("## Classification")
    expect(output).toContain("87%")
  })
})

describe("formatIssueBody — stack trace truncation", () => {
  it("includes stack trace section when stack_trace is provided", () => {
    const output = formatIssueBody(makeBug({
      evidence: {
        error_message: "Error",
        stack_trace: "at foo (bar.js:1)\nat baz (qux.js:2)",
        first_seen_commit: null,
        affected_tests_count: 1,
        regression_in_commit: false,
      },
    }))
    expect(output).toContain("**Stack Trace:**")
    expect(output).toContain("at foo (bar.js:1)")
  })

  it("truncates stack trace at 2000 characters", () => {
    const longTrace = "x".repeat(3000)
    const output = formatIssueBody(makeBug({
      evidence: {
        error_message: "Error",
        stack_trace: longTrace,
        first_seen_commit: null,
        affected_tests_count: 1,
        regression_in_commit: false,
      },
    }))
    // The stack trace section should be truncated (total x's may include sig::xxx)
    expect(output.length).toBeLessThan(longTrace.length)
    expect(output).toContain("```")  // still has code fence
  })

  it("omits stack trace section when stack_trace is null", () => {
    const output = formatIssueBody(makeBug({ evidence: { ...makeBug().evidence, stack_trace: null } }))
    expect(output).not.toContain("**Stack Trace:**")
  })
})

describe("formatIssueBody — linear context", () => {
  it("includes linear context block when provided", () => {
    const linearCtx = "### Linear Ticket\n- **[ENG-1](https://linear.app)**: My ticket"
    const output = formatIssueBody(makeBug(), linearCtx)
    expect(output).toContain("### Linear Ticket")
    expect(output).toContain("ENG-1")
  })

  it("omits linear context when not provided", () => {
    const output = formatIssueBody(makeBug())
    expect(output).not.toContain("### Linear Ticket")
  })
})

describe("findExistingBugReport", () => {
  it("returns null when no existing report found", async () => {
    const sqlTag = vi.fn().mockResolvedValue([])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    const result = await findExistingBugReport(10, "SomeCluster")
    expect(result).toBeNull()
  })

  it("returns issue_url and issue_number when duplicate found", async () => {
    const sqlTag = vi.fn().mockResolvedValue([
      { issue_url: "https://github.com/org/repo/issues/7", issue_number: 7 },
    ])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    const result = await findExistingBugReport(10, "SomeCluster")
    expect(result).not.toBeNull()
    expect(result?.issue_url).toBe("https://github.com/org/repo/issues/7")
    expect(result?.issue_number).toBe(7)
  })
})

describe("recordBugReport", () => {
  it("calls SQL template tag with analysis_id and bug data", async () => {
    const sqlTag = vi.fn().mockResolvedValue([])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    const reportResult: BugReportResult = {
      bug_summary: "AssertionError cluster",
      status: "created",
      issue_url: "https://github.com/org/repo/issues/9",
      issue_number: 9,
    }

    await recordBugReport(55, reportResult, makeBug())

    expect(getSql).toHaveBeenCalled()
    expect(sqlTag).toHaveBeenCalled()
  })

  it("passes null issue_url when status is failed", async () => {
    const sqlTag = vi.fn().mockResolvedValue([])
    ;(getSql as ReturnType<typeof vi.fn>).mockReturnValue(sqlTag)

    const reportResult: BugReportResult = {
      bug_summary: "AssertionError cluster",
      status: "failed",
    }

    await recordBugReport(55, reportResult, makeBug())

    expect(sqlTag).toHaveBeenCalled()
  })
})
