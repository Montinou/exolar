/**
 * Exolar Playwright Reporter - Utility Functions
 */

import type { TestCase, TestResult } from "@playwright/test/reporter"
import type { AIFailureContext, LogEntry } from "./types"
import * as path from "path"

/**
 * Detect if running in CI environment
 */
export function isCI(): boolean {
  return process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true"
}

/**
 * Get execution metadata from environment variables
 */
export function getExecutionContext() {
  return {
    run_id: process.env.GITHUB_RUN_ID || `local-${Date.now()}`,
    // GITHUB_HEAD_REF for PRs (actual branch name), fallback to GITHUB_REF_NAME
    branch:
      process.env.GITHUB_HEAD_REF ||
      process.env.GITHUB_REF_NAME ||
      "local",
    commit_sha: process.env.GITHUB_SHA || "local",
    commit_message: process.env.GITHUB_COMMIT_MESSAGE,
    triggered_by: process.env.GITHUB_ACTOR
      ? `${process.env.GITHUB_EVENT_NAME} by ${process.env.GITHUB_ACTOR}`
      : undefined,
    workflow_name: process.env.GITHUB_WORKFLOW || "E2E Tests",
    suite: process.env.TEST_SUITE_NAME,
  }
}

/**
 * Parse error type from message and stack trace
 */
export function parseErrorType(message: string, stack: string): string {
  // Common Playwright error types
  if (message.includes("Timeout") || message.includes("exceeded"))
    return "TimeoutError"
  if (message.includes("strict mode violation")) return "StrictModeError"
  if (message.includes("expect(")) return "AssertionError"
  if (message.includes("navigation")) return "NavigationError"
  if (message.includes("net::")) return "NetworkError"
  if (stack.includes("AssertionError")) return "AssertionError"
  return "Error"
}

/**
 * Parse error location from stack trace
 */
export function parseErrorLocation(stack: string, testFile: string): string {
  const lines = stack.split("\n")
  for (const line of lines) {
    if (line.includes(testFile)) {
      const match = line.match(/:(\d+):(\d+)/)
      if (match) {
        return `${testFile}:${match[1]}:${match[2]}`
      }
    }
  }
  return testFile
}

/**
 * Extract last API call from logs or attachments
 */
export function extractLastApiCall(
  logs: LogEntry[],
  attachments: TestResult["attachments"]
): AIFailureContext["last_api"] | undefined {
  // Look for API logs
  const apiLogs = logs.filter(
    (l) => l.source?.includes("api") || l.message?.includes("/graphql")
  )
  if (apiLogs.length > 0) {
    const lastApi = apiLogs[apiLogs.length - 1]
    return {
      method: (lastApi.data?.method as string) || "POST",
      url: (lastApi.data?.url as string) || "/graphql",
      status: (lastApi.data?.status as number) || 200,
      operation: lastApi.data?.operation as string | undefined,
    }
  }

  // Fallback: check annotations for last-api
  const apiAttachment = attachments?.find((a) => a.name === "last-api")
  if (apiAttachment?.body) {
    try {
      return JSON.parse(apiAttachment.body.toString())
    } catch {
      /* ignore */
    }
  }

  return undefined
}

/**
 * Extract page URL from logs
 */
export function extractPageUrl(logs: LogEntry[]): string | undefined {
  const navLogs = logs.filter(
    (l) =>
      l.source?.includes("navigation") ||
      l.message?.includes("Navigate") ||
      l.data?.url
  )
  if (navLogs.length > 0) {
    return navLogs[navLogs.length - 1].data?.url as string
  }
  return undefined
}

/**
 * Build AI-enriched failure context
 */
export function buildAIContext(
  test: TestCase,
  result: TestResult,
  logs: LogEntry[],
  execution: { run_id: string; branch: string; commit_sha: string },
  rootDir: string
): AIFailureContext {
  const testFile = path.relative(rootDir || process.cwd(), test.location.file)
  const testId = `${testFile}::${test.title}`

  const errorMessage = result.error?.message || "Unknown error"
  const errorStack = result.error?.stack || ""
  const errorType = parseErrorType(errorMessage, errorStack)
  const errorLocation = parseErrorLocation(errorStack, testFile)

  // Extract test steps from Playwright's result.steps
  const steps = result.steps
    .filter((s) => s.category === "test.step")
    .map((s) => s.title)
    .slice(-10) // Last 10 steps

  const lastStep = steps[steps.length - 1] || "Unknown"
  const lastApi = extractLastApiCall(logs, result.attachments)
  const pageUrl = extractPageUrl(logs)

  return {
    test_id: testId,
    timestamp: new Date().toISOString(),
    file: testFile,
    suite: test.titlePath().slice(0, -1),
    test: test.title,
    error: {
      message: errorMessage,
      type: errorType,
      location: errorLocation,
    },
    steps,
    last_step: lastStep,
    duration_ms: result.duration,
    retries: result.retry,
    last_api: lastApi,
    page_url: pageUrl,
    browser: test.parent?.project()?.name || "chromium",
    logs: logs.slice(-20), // Last 20 logs for context
    execution: {
      run_id: execution.run_id,
      branch: execution.branch,
      commit_sha: execution.commit_sha,
    },
  }
}

/**
 * Extract logs from test annotations
 */
export function extractLogs(result: TestResult): LogEntry[] {
  const logs: LogEntry[] = []

  // Extract from test-logs annotation (TestLogger service format)
  const logsAnnotation = (result.annotations || []).find(
    (a) => a.type === "test-logs"
  )
  if (logsAnnotation && logsAnnotation.description) {
    try {
      const parsedLogs = JSON.parse(logsAnnotation.description)
      if (Array.isArray(parsedLogs)) {
        logs.push(...parsedLogs)
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Extract from stdout/stderr as fallback
  for (const attachment of result.attachments || []) {
    if (attachment.name === "stdout" && attachment.body) {
      logs.push({
        timestamp: Date.now(),
        level: "info",
        source: "stdout",
        message: attachment.body.toString("utf-8").substring(0, 1000),
      })
    }
    if (attachment.name === "stderr" && attachment.body) {
      logs.push({
        timestamp: Date.now(),
        level: "error",
        source: "stderr",
        message: attachment.body.toString("utf-8").substring(0, 1000),
      })
    }
  }

  return logs
}
