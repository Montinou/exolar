/**
 * @exolar/playwright-reporter
 *
 * A Playwright reporter that sends test results to the Exolar QA Dashboard.
 *
 * @example
 * ```typescript
 * // playwright.config.ts
 * import { exolar } from "@exolar/playwright-reporter";
 *
 * export default defineConfig({
 *   reporter: [
 *     ["html"],
 *     [exolar, { apiKey: process.env.EXOLAR_API_KEY }]
 *   ],
 * });
 * ```
 */

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter"
import * as fs from "fs"
import * as path from "path"

import type {
  ExolarReporterOptions,
  AIFailureContext,
  ArtifactPayload,
  ExecutionPayload,
  IngestPayload,
  IngestResponse,
  LogEntry,
  TestResultPayload,
} from "./types"

import {
  buildAIContext,
  extractLogs,
  getExecutionContext,
  isCI,
} from "./utils"

// Re-export types for consumers
export type {
  ExolarReporterOptions,
  AIFailureContext,
  ArtifactPayload,
  ExecutionPayload,
  IngestPayload,
  IngestResponse,
  LogEntry,
  TestResultPayload,
} from "./types"

// Default Exolar endpoint
const DEFAULT_ENDPOINT = "https://exolar.qa"

/**
 * Exolar Playwright Reporter
 *
 * Automatically uploads test results to your Exolar dashboard.
 * Only activates in CI environments by default.
 */
class ExolarReporter implements Reporter {
  private options: Required<ExolarReporterOptions>
  private testResults: TestResultPayload[] = []
  private artifacts: ArtifactPayload[] = []
  private startTime: Date = new Date()
  private rootDir: string = ""
  private passed = 0
  private failed = 0
  private skipped = 0
  private enabled = false

  constructor(options: ExolarReporterOptions = {}) {
    this.options = {
      endpoint: options.endpoint || process.env.EXOLAR_URL || DEFAULT_ENDPOINT,
      apiKey: options.apiKey || process.env.EXOLAR_API_KEY || "",
      onlyOnFailure: options.onlyOnFailure ?? false,
      includeArtifacts: options.includeArtifacts ?? true,
      maxArtifactSize: options.maxArtifactSize ?? 5 * 1024 * 1024, // 5MB
      disabled: options.disabled ?? false,
    }
  }

  /**
   * Called once at the beginning of the test run
   */
  onBegin(config: FullConfig, _suite: Suite): void {
    this.rootDir = config.rootDir
    this.startTime = new Date()
    this.testResults = []
    this.artifacts = []
    this.passed = 0
    this.failed = 0
    this.skipped = 0

    // Check if reporter should be enabled
    if (this.options.disabled) {
      return
    }

    if (!isCI()) {
      // Silently skip in local development
      return
    }

    if (!this.options.apiKey) {
      console.log(
        "[Exolar] EXOLAR_API_KEY not set, reporter disabled"
      )
      return
    }

    this.enabled = true
    console.log("[Exolar] Initialized - will send results to dashboard")
  }

  /**
   * Called after each test completes
   */
  onTestEnd(test: TestCase, result: TestResult): void {
    const status = this.mapStatus(result.status)
    const logs = extractLogs(result)
    const testFile = this.getRelativeTestFile(test)
    const execution = getExecutionContext()

    // Build AI context for failed tests
    if (status === "failed" || status === "timedout") {
      const aiContext = buildAIContext(
        test,
        result,
        logs,
        execution,
        this.rootDir
      )

      // Export local JSON file for AI consumption
      this.exportLocalJson(aiContext)

      // Only continue if reporter is enabled (CI mode)
      if (!this.enabled) return

      const testResult: TestResultPayload = {
        test_name: test.title,
        test_file: testFile,
        status,
        duration_ms: result.duration,
        is_critical: this.isCriticalTest(test),
        browser: test.parent?.project()?.name || "chromium",
        retry_count: result.retry,
        started_at: new Date(result.startTime.getTime()).toISOString(),
        completed_at: new Date(
          result.startTime.getTime() + result.duration
        ).toISOString(),
        logs: logs.length > 0 ? logs : undefined,
        error_message: result.error?.message || "Unknown error",
        stack_trace: result.error?.stack,
        ai_context: aiContext,
      }

      this.testResults.push(testResult)
      this.failed++

      // Collect artifacts for failed tests
      if (this.options.includeArtifacts) {
        this.collectArtifacts(test, result, testFile)
      }
      return
    }

    // For non-failed tests, only process if enabled
    if (!this.enabled) return

    // Update counters
    if (status === "passed") this.passed++
    else if (status === "skipped") this.skipped++

    const testResult: TestResultPayload = {
      test_name: test.title,
      test_file: testFile,
      status,
      duration_ms: result.duration,
      is_critical: this.isCriticalTest(test),
      browser: test.parent?.project()?.name || "chromium",
      retry_count: result.retry,
      started_at: new Date(result.startTime.getTime()).toISOString(),
      completed_at: new Date(
        result.startTime.getTime() + result.duration
      ).toISOString(),
      logs: logs.length > 0 ? logs : undefined,
    }

    this.testResults.push(testResult)
  }

  /**
   * Called once after all tests complete
   */
  async onEnd(_result: FullResult): Promise<void> {
    if (!this.enabled) return

    // Skip if onlyOnFailure is true and no failures
    if (this.options.onlyOnFailure && this.failed === 0) {
      console.log(
        "[Exolar] All tests passed, skipping upload (onlyOnFailure=true)"
      )
      return
    }

    const endTime = new Date()
    const durationMs = endTime.getTime() - this.startTime.getTime()
    const context = getExecutionContext()

    const execution: ExecutionPayload = {
      ...context,
      status: this.failed > 0 ? "failure" : "success",
      total_tests: this.testResults.length,
      passed: this.passed,
      failed: this.failed,
      skipped: this.skipped,
      duration_ms: durationMs,
      started_at: this.startTime.toISOString(),
      completed_at: endTime.toISOString(),
    }

    const payload: IngestPayload = {
      execution,
      results: this.testResults,
      artifacts: this.artifacts,
    }

    await this.sendToDashboard(payload)
  }

  // ============================================
  // Helper Methods
  // ============================================

  private mapStatus(
    playwrightStatus: TestResult["status"]
  ): TestResultPayload["status"] {
    switch (playwrightStatus) {
      case "passed":
        return "passed"
      case "failed":
        return "failed"
      case "timedOut":
        return "timedout"
      case "skipped":
        return "skipped"
      case "interrupted":
        return "failed"
      default:
        return "failed"
    }
  }

  private getRelativeTestFile(test: TestCase): string {
    const location = test.location
    if (!location) return "unknown"

    let filePath = location.file
    if (filePath.startsWith(this.rootDir)) {
      filePath = filePath.slice(this.rootDir.length + 1)
    }

    return filePath
  }

  private isCriticalTest(test: TestCase): boolean {
    const tags = test.tags || []
    if (tags.includes("@critical")) return true
    if (test.title.toLowerCase().includes("critical")) return true

    let parent: Suite | undefined = test.parent
    while (parent) {
      if (parent.title?.toLowerCase().includes("critical")) return true
      parent = parent.parent
    }

    return false
  }

  private collectArtifacts(
    test: TestCase,
    result: TestResult,
    testFile: string
  ): void {
    const testName = test.title

    for (const attachment of result.attachments || []) {
      if (!attachment.body && !attachment.path) continue

      let type: ArtifactPayload["type"] | null = null
      if (
        attachment.name === "screenshot" ||
        attachment.contentType?.startsWith("image/")
      ) {
        type = "screenshot"
      } else if (
        attachment.name === "trace" ||
        attachment.path?.endsWith(".zip")
      ) {
        type = "trace"
      } else if (attachment.contentType?.startsWith("video/")) {
        type = "video"
      }

      if (!type) continue

      try {
        let data: Buffer

        if (attachment.body) {
          data = attachment.body
        } else if (attachment.path && fs.existsSync(attachment.path)) {
          data = fs.readFileSync(attachment.path)
        } else {
          continue
        }

        if (data.length > this.options.maxArtifactSize) {
          console.log(
            `[Exolar] Skipping artifact ${attachment.name} - exceeds size limit`
          )
          continue
        }

        const filename =
          attachment.name || path.basename(attachment.path || "artifact")

        this.artifacts.push({
          test_name: testName,
          test_file: testFile,
          type,
          filename,
          mime_type: attachment.contentType || "application/octet-stream",
          data: data.toString("base64"),
        })
      } catch (error) {
        console.warn(
          `[Exolar] Failed to read artifact ${attachment.path}:`,
          error
        )
      }
    }
  }

  private exportLocalJson(aiContext: AIFailureContext): void {
    try {
      const outputDir = path.join(
        this.rootDir || process.cwd(),
        "test-results",
        "ai-failures"
      )
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      const safeTestId = aiContext.test_id
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 200)

      const filename = `${safeTestId}.json`
      const filepath = path.join(outputDir, filename)

      fs.writeFileSync(filepath, JSON.stringify(aiContext, null, 2))
      console.log(`[Exolar] AI context exported: ${filepath}`)
    } catch (error) {
      console.error("[Exolar] Failed to export AI context:", error)
    }
  }

  private async sendToDashboard(payload: IngestPayload): Promise<void> {
    const url = `${this.options.endpoint}/api/test-results`

    console.log(
      `[Exolar] Sending ${payload.results.length} results to dashboard...`
    )

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(
          `[Exolar] Failed to send results: ${response.status} ${errorText}`
        )
        return
      }

      const result: IngestResponse = await response.json()
      console.log(
        `[Exolar] Results sent successfully - execution_id: ${result.execution_id}`
      )
    } catch (error) {
      console.error("[Exolar] Failed to send results:", error)
    }
  }
}

/**
 * Named export for use in playwright.config.ts
 *
 * @example
 * ```typescript
 * import { exolar } from "@exolar-qa/playwright-reporter";
 *
 * export default defineConfig({
 *   reporter: [["html"], [exolar, { apiKey: process.env.EXOLAR_API_KEY }]],
 * });
 * ```
 */
export const exolar = ExolarReporter

/**
 * Default export for alternative import style
 */
export default ExolarReporter
