"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => index_default,
  exolar: () => exolar
});
module.exports = __toCommonJS(index_exports);
var fs = __toESM(require("fs"));
var path2 = __toESM(require("path"));

// src/utils.ts
var path = __toESM(require("path"));
function isCI() {
  return process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
}
function getExecutionContext() {
  return {
    run_id: process.env.GITHUB_RUN_ID || `local-${Date.now()}`,
    // GITHUB_HEAD_REF for PRs (actual branch name), fallback to GITHUB_REF_NAME
    branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "local",
    commit_sha: process.env.GITHUB_SHA || "local",
    commit_message: process.env.GITHUB_COMMIT_MESSAGE,
    triggered_by: process.env.GITHUB_ACTOR ? `${process.env.GITHUB_EVENT_NAME} by ${process.env.GITHUB_ACTOR}` : void 0,
    workflow_name: process.env.GITHUB_WORKFLOW || "E2E Tests",
    suite: process.env.TEST_SUITE_NAME
  };
}
function parseErrorType(message, stack) {
  if (message.includes("Timeout") || message.includes("exceeded"))
    return "TimeoutError";
  if (message.includes("strict mode violation")) return "StrictModeError";
  if (message.includes("expect(")) return "AssertionError";
  if (message.includes("navigation")) return "NavigationError";
  if (message.includes("net::")) return "NetworkError";
  if (stack.includes("AssertionError")) return "AssertionError";
  return "Error";
}
function parseErrorLocation(stack, testFile) {
  const lines = stack.split("\n");
  for (const line of lines) {
    if (line.includes(testFile)) {
      const match = line.match(/:(\d+):(\d+)/);
      if (match) {
        return `${testFile}:${match[1]}:${match[2]}`;
      }
    }
  }
  return testFile;
}
function extractLastApiCall(logs, attachments) {
  const apiLogs = logs.filter(
    (l) => l.source?.includes("api") || l.message?.includes("/graphql")
  );
  if (apiLogs.length > 0) {
    const lastApi = apiLogs[apiLogs.length - 1];
    return {
      method: lastApi.data?.method || "POST",
      url: lastApi.data?.url || "/graphql",
      status: lastApi.data?.status || 200,
      operation: lastApi.data?.operation
    };
  }
  const apiAttachment = attachments?.find((a) => a.name === "last-api");
  if (apiAttachment?.body) {
    try {
      return JSON.parse(apiAttachment.body.toString());
    } catch {
    }
  }
  return void 0;
}
function extractPageUrl(logs) {
  const navLogs = logs.filter(
    (l) => l.source?.includes("navigation") || l.message?.includes("Navigate") || l.data?.url
  );
  if (navLogs.length > 0) {
    return navLogs[navLogs.length - 1].data?.url;
  }
  return void 0;
}
function buildAIContext(test, result, logs, execution, rootDir) {
  const testFile = path.relative(rootDir || process.cwd(), test.location.file);
  const testId = `${testFile}::${test.title}`;
  const errorMessage = result.error?.message || "Unknown error";
  const errorStack = result.error?.stack || "";
  const errorType = parseErrorType(errorMessage, errorStack);
  const errorLocation = parseErrorLocation(errorStack, testFile);
  const steps = result.steps.filter((s) => s.category === "test.step").map((s) => s.title).slice(-10);
  const lastStep = steps[steps.length - 1] || "Unknown";
  const lastApi = extractLastApiCall(logs, result.attachments);
  const pageUrl = extractPageUrl(logs);
  return {
    test_id: testId,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    file: testFile,
    suite: test.titlePath().slice(0, -1),
    test: test.title,
    error: {
      message: errorMessage,
      type: errorType,
      location: errorLocation
    },
    steps,
    last_step: lastStep,
    duration_ms: result.duration,
    retries: result.retry,
    last_api: lastApi,
    page_url: pageUrl,
    browser: test.parent?.project()?.name || "chromium",
    logs: logs.slice(-20),
    // Last 20 logs for context
    execution: {
      run_id: execution.run_id,
      branch: execution.branch,
      commit_sha: execution.commit_sha
    }
  };
}
function extractLogs(result) {
  const logs = [];
  const logsAnnotation = (result.annotations || []).find(
    (a) => a.type === "test-logs"
  );
  if (logsAnnotation && logsAnnotation.description) {
    try {
      const parsedLogs = JSON.parse(logsAnnotation.description);
      if (Array.isArray(parsedLogs)) {
        logs.push(...parsedLogs);
      }
    } catch {
    }
  }
  for (const attachment of result.attachments || []) {
    if (attachment.name === "stdout" && attachment.body) {
      logs.push({
        timestamp: Date.now(),
        level: "info",
        source: "stdout",
        message: attachment.body.toString("utf-8").substring(0, 1e3)
      });
    }
    if (attachment.name === "stderr" && attachment.body) {
      logs.push({
        timestamp: Date.now(),
        level: "error",
        source: "stderr",
        message: attachment.body.toString("utf-8").substring(0, 1e3)
      });
    }
  }
  return logs;
}

// src/index.ts
var DEFAULT_ENDPOINT = "https://exolar.qa";
var ExolarReporter = class {
  constructor(options = {}) {
    this.testResults = [];
    this.artifacts = [];
    this.startTime = /* @__PURE__ */ new Date();
    this.rootDir = "";
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
    this.enabled = false;
    this.options = {
      endpoint: options.endpoint || process.env.EXOLAR_URL || DEFAULT_ENDPOINT,
      apiKey: options.apiKey || process.env.EXOLAR_API_KEY || "",
      onlyOnFailure: options.onlyOnFailure ?? false,
      includeArtifacts: options.includeArtifacts ?? true,
      maxArtifactSize: options.maxArtifactSize ?? 5 * 1024 * 1024,
      // 5MB
      disabled: options.disabled ?? false
    };
  }
  /**
   * Called once at the beginning of the test run
   */
  onBegin(config, _suite) {
    this.rootDir = config.rootDir;
    this.startTime = /* @__PURE__ */ new Date();
    this.testResults = [];
    this.artifacts = [];
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
    if (this.options.disabled) {
      return;
    }
    if (!isCI()) {
      return;
    }
    if (!this.options.apiKey) {
      console.log(
        "[Exolar] EXOLAR_API_KEY not set, reporter disabled"
      );
      return;
    }
    this.enabled = true;
    console.log("[Exolar] Initialized - will send results to dashboard");
  }
  /**
   * Called after each test completes
   */
  onTestEnd(test, result) {
    const status = this.mapStatus(result.status);
    const logs = extractLogs(result);
    const testFile = this.getRelativeTestFile(test);
    const execution = getExecutionContext();
    if (status === "failed" || status === "timedout") {
      const aiContext = buildAIContext(
        test,
        result,
        logs,
        execution,
        this.rootDir
      );
      this.exportLocalJson(aiContext);
      if (!this.enabled) return;
      const testResult2 = {
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
        logs: logs.length > 0 ? logs : void 0,
        error_message: result.error?.message || "Unknown error",
        stack_trace: result.error?.stack,
        ai_context: aiContext
      };
      this.testResults.push(testResult2);
      this.failed++;
      if (this.options.includeArtifacts) {
        this.collectArtifacts(test, result, testFile);
      }
      return;
    }
    if (!this.enabled) return;
    if (status === "passed") this.passed++;
    else if (status === "skipped") this.skipped++;
    const testResult = {
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
      logs: logs.length > 0 ? logs : void 0
    };
    this.testResults.push(testResult);
  }
  /**
   * Called once after all tests complete
   */
  async onEnd(_result) {
    if (!this.enabled) return;
    if (this.options.onlyOnFailure && this.failed === 0) {
      console.log(
        "[Aestra] All tests passed, skipping upload (onlyOnFailure=true)"
      );
      return;
    }
    const endTime = /* @__PURE__ */ new Date();
    const durationMs = endTime.getTime() - this.startTime.getTime();
    const context = getExecutionContext();
    const execution = {
      ...context,
      status: this.failed > 0 ? "failure" : "success",
      total_tests: this.testResults.length,
      passed: this.passed,
      failed: this.failed,
      skipped: this.skipped,
      duration_ms: durationMs,
      started_at: this.startTime.toISOString(),
      completed_at: endTime.toISOString()
    };
    const payload = {
      execution,
      results: this.testResults,
      artifacts: this.artifacts
    };
    await this.sendToDashboard(payload);
  }
  // ============================================
  // Helper Methods
  // ============================================
  mapStatus(playwrightStatus) {
    switch (playwrightStatus) {
      case "passed":
        return "passed";
      case "failed":
        return "failed";
      case "timedOut":
        return "timedout";
      case "skipped":
        return "skipped";
      case "interrupted":
        return "failed";
      default:
        return "failed";
    }
  }
  getRelativeTestFile(test) {
    const location = test.location;
    if (!location) return "unknown";
    let filePath = location.file;
    if (filePath.startsWith(this.rootDir)) {
      filePath = filePath.slice(this.rootDir.length + 1);
    }
    return filePath;
  }
  isCriticalTest(test) {
    const tags = test.tags || [];
    if (tags.includes("@critical")) return true;
    if (test.title.toLowerCase().includes("critical")) return true;
    let parent = test.parent;
    while (parent) {
      if (parent.title?.toLowerCase().includes("critical")) return true;
      parent = parent.parent;
    }
    return false;
  }
  collectArtifacts(test, result, testFile) {
    const testName = test.title;
    for (const attachment of result.attachments || []) {
      if (!attachment.body && !attachment.path) continue;
      let type = null;
      if (attachment.name === "screenshot" || attachment.contentType?.startsWith("image/")) {
        type = "screenshot";
      } else if (attachment.name === "trace" || attachment.path?.endsWith(".zip")) {
        type = "trace";
      } else if (attachment.contentType?.startsWith("video/")) {
        type = "video";
      }
      if (!type) continue;
      try {
        let data;
        if (attachment.body) {
          data = attachment.body;
        } else if (attachment.path && fs.existsSync(attachment.path)) {
          data = fs.readFileSync(attachment.path);
        } else {
          continue;
        }
        if (data.length > this.options.maxArtifactSize) {
          console.log(
            `[Exolar] Skipping artifact ${attachment.name} - exceeds size limit`
          );
          continue;
        }
        const filename = attachment.name || path2.basename(attachment.path || "artifact");
        this.artifacts.push({
          test_name: testName,
          test_file: testFile,
          type,
          filename,
          mime_type: attachment.contentType || "application/octet-stream",
          data: data.toString("base64")
        });
      } catch (error) {
        console.warn(
          `[Exolar] Failed to read artifact ${attachment.path}:`,
          error
        );
      }
    }
  }
  exportLocalJson(aiContext) {
    try {
      const outputDir = path2.join(
        this.rootDir || process.cwd(),
        "test-results",
        "ai-failures"
      );
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      const safeTestId = aiContext.test_id.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").slice(0, 200);
      const filename = `${safeTestId}.json`;
      const filepath = path2.join(outputDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(aiContext, null, 2));
      console.log(`[Exolar] AI context exported: ${filepath}`);
    } catch (error) {
      console.error("[Exolar] Failed to export AI context:", error);
    }
  }
  async sendToDashboard(payload) {
    const url = `${this.options.endpoint}/api/test-results`;
    console.log(
      `[Exolar] Sending ${payload.results.length} results to dashboard...`
    );
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.options.apiKey}`
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[Exolar] Failed to send results: ${response.status} ${errorText}`
        );
        return;
      }
      const result = await response.json();
      console.log(
        `[Exolar] Results sent successfully - execution_id: ${result.execution_id}`
      );
    } catch (error) {
      console.error("[Exolar] Failed to send results:", error);
    }
  }
};
var exolar = ExolarReporter;
var index_default = ExolarReporter;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  exolar
});
