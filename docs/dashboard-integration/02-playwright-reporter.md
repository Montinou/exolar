# Phase 02: Playwright Custom Reporter

> **Priority:** Critical | **Complexity:** Medium | **Dependencies:** Phase 01 (Data Ingestion Endpoint)
>
> Creates a custom Playwright reporter that sends test results to the dashboard (CI only).

---

## Objective

1. Create custom Playwright reporter that collects test results
2. Send results to dashboard API on test completion
3. Capture screenshots and traces for failed tests
4. Only activate in CI environments
5. Support configurable endpoint and API key

---

## Prerequisites

- Phase 01 complete (data ingestion endpoint deployed)
- `DASHBOARD_URL` and `DASHBOARD_API_KEY` environment variables available in CI

---

## Implementation

### 1. Create Reporter Directory

```bash
mkdir -p attorney_share_mvp_web/automation/playwright/reporters
```

### 2. Create Dashboard Reporter (`reporters/dashboard-reporter.ts`)

```typescript
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

// Types matching the dashboard API
interface ExecutionRequest {
  run_id: string;
  branch: string;
  commit_sha: string;
  commit_message?: string;
  triggered_by: string;
  workflow_name: string;
  status: 'success' | 'failure' | 'running';
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  started_at: string;
  completed_at?: string;
}

interface TestResultRequest {
  test_name: string;
  test_file: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedout';
  duration_ms: number;
  is_critical?: boolean;
  error_message?: string;
  stack_trace?: string;
  browser: string;
  retry_count: number;
  started_at: string;
  completed_at?: string;
  logs?: LogEntry[];
}

interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error' | 'metric';
  source: string;
  message: string;
  data?: Record<string, unknown>;
}

interface ArtifactRequest {
  test_name: string;
  test_file: string;
  type: 'screenshot' | 'trace' | 'video';
  filename: string;
  mime_type: string;
  data: string;
}

interface DashboardReporterOptions {
  endpoint?: string;
  apiKey?: string;
  onlyOnFailure?: boolean;
  includeArtifacts?: boolean;
  maxArtifactSize?: number;  // bytes
}

class DashboardReporter implements Reporter {
  private options: Required<DashboardReporterOptions>;
  private testResults: TestResultRequest[] = [];
  private artifacts: ArtifactRequest[] = [];
  private startTime: Date = new Date();
  private config: FullConfig | null = null;

  constructor(options: DashboardReporterOptions = {}) {
    this.options = {
      endpoint: options.endpoint || process.env.DASHBOARD_URL || '',
      apiKey: options.apiKey || process.env.DASHBOARD_API_KEY || '',
      onlyOnFailure: options.onlyOnFailure ?? true,
      includeArtifacts: options.includeArtifacts ?? true,
      maxArtifactSize: options.maxArtifactSize ?? 5 * 1024 * 1024, // 5MB default
    };

    if (!this.options.endpoint) {
      console.warn('[DashboardReporter] No endpoint configured, results will not be sent');
    }
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.startTime = new Date();
    this.testResults = [];
    this.artifacts = [];

    console.log('[DashboardReporter] Starting test run...');
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const status = this.mapStatus(result.status);
    const testFile = this.getRelativeTestFile(test.location.file);
    const testName = test.title;

    // For onlyOnFailure mode, only collect detailed data for failures
    const isFailure = status === 'failed' || status === 'timedout';
    const shouldCollectDetails = !this.options.onlyOnFailure || isFailure;

    const testResult: TestResultRequest = {
      test_name: testName,
      test_file: testFile,
      status,
      duration_ms: result.duration,
      is_critical: test.tags.includes('@critical'),
      browser: test.parent?.project()?.name || 'unknown',
      retry_count: result.retry,
      started_at: new Date(result.startTime).toISOString(),
      completed_at: new Date(result.startTime.getTime() + result.duration).toISOString(),
    };

    // Add error details for failures
    if (isFailure && result.error) {
      testResult.error_message = result.error.message || 'Unknown error';
      testResult.stack_trace = result.error.stack;
    }

    // Collect logs if available (from TestLogger via annotations)
    if (shouldCollectDetails) {
      const logsAnnotation = result.annotations.find(a => a.type === 'test-logs');
      if (logsAnnotation && logsAnnotation.description) {
        try {
          testResult.logs = JSON.parse(logsAnnotation.description);
        } catch {
          // Ignore parse errors
        }
      }
    }

    this.testResults.push(testResult);

    // Collect artifacts for failures
    if (isFailure && this.options.includeArtifacts) {
      this.collectArtifacts(test, result, testName, testFile);
    }
  }

  private collectArtifacts(
    test: TestCase,
    result: TestResult,
    testName: string,
    testFile: string
  ): void {
    for (const attachment of result.attachments) {
      // Skip attachments without body or path
      if (!attachment.body && !attachment.path) continue;

      // Determine artifact type
      let artifactType: 'screenshot' | 'trace' | 'video';
      if (attachment.name.includes('screenshot') || attachment.contentType?.includes('image')) {
        artifactType = 'screenshot';
      } else if (attachment.name.includes('trace') || attachment.path?.endsWith('.zip')) {
        artifactType = 'trace';
      } else if (attachment.contentType?.includes('video')) {
        artifactType = 'video';
      } else {
        continue; // Skip unknown attachment types
      }

      try {
        let data: Buffer;

        if (attachment.body) {
          data = attachment.body;
        } else if (attachment.path && fs.existsSync(attachment.path)) {
          data = fs.readFileSync(attachment.path);
        } else {
          continue;
        }

        // Check size limit
        if (data.length > this.options.maxArtifactSize) {
          console.warn(`[DashboardReporter] Artifact too large: ${attachment.name} (${data.length} bytes)`);
          continue;
        }

        const filename = attachment.name || path.basename(attachment.path || 'artifact');

        this.artifacts.push({
          test_name: testName,
          test_file: testFile,
          type: artifactType,
          filename,
          mime_type: attachment.contentType || 'application/octet-stream',
          data: data.toString('base64'),
        });
      } catch (error) {
        console.warn(`[DashboardReporter] Failed to read artifact: ${attachment.name}`, error);
      }
    }
  }

  async onEnd(result: FullResult): Promise<void> {
    if (!this.options.endpoint) {
      console.log('[DashboardReporter] No endpoint configured, skipping upload');
      return;
    }

    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();

    // Count results
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed' || r.status === 'timedout').length;
    const skipped = this.testResults.filter(r => r.status === 'skipped').length;

    // Build execution request
    const execution: ExecutionRequest = {
      run_id: this.getRunId(),
      branch: this.getBranch(),
      commit_sha: this.getCommitSha(),
      commit_message: this.getCommitMessage(),
      triggered_by: this.getTriggeredBy(),
      workflow_name: this.getWorkflowName(),
      status: failed > 0 ? 'failure' : 'success',
      total_tests: this.testResults.length,
      passed,
      failed,
      skipped,
      duration_ms: duration,
      started_at: this.startTime.toISOString(),
      completed_at: endTime.toISOString(),
    };

    // Prepare payload
    const payload = {
      execution,
      results: this.testResults,
      artifacts: this.artifacts.length > 0 ? this.artifacts : undefined,
    };

    console.log(`[DashboardReporter] Sending ${this.testResults.length} results to dashboard...`);

    try {
      const response = await fetch(`${this.options.endpoint}/api/test-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        console.log(`[DashboardReporter] Successfully uploaded results (execution_id: ${responseData.execution_id})`);
      } else {
        console.error(`[DashboardReporter] Failed to upload results: ${responseData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('[DashboardReporter] Error sending results:', error);
    }
  }

  // Helper methods
  private mapStatus(status: string): 'passed' | 'failed' | 'skipped' | 'timedout' {
    switch (status) {
      case 'passed':
        return 'passed';
      case 'failed':
        return 'failed';
      case 'skipped':
        return 'skipped';
      case 'timedOut':
        return 'timedout';
      default:
        return 'failed';
    }
  }

  private getRelativeTestFile(absolutePath: string): string {
    const projectRoot = process.cwd();
    return path.relative(projectRoot, absolutePath);
  }

  private getRunId(): string {
    // GitHub Actions run ID, or fallback to timestamp
    return process.env.GITHUB_RUN_ID || `local-${Date.now()}`;
  }

  private getBranch(): string {
    // GitHub branch name
    return process.env.GITHUB_REF_NAME ||
           process.env.GITHUB_HEAD_REF ||
           process.env.GIT_BRANCH ||
           'unknown';
  }

  private getCommitSha(): string {
    return process.env.GITHUB_SHA || 'unknown';
  }

  private getCommitMessage(): string | undefined {
    // Not directly available in GitHub Actions, would need to be passed
    return process.env.COMMIT_MESSAGE;
  }

  private getTriggeredBy(): string {
    const actor = process.env.GITHUB_ACTOR;
    const event = process.env.GITHUB_EVENT_NAME;

    if (actor && event) {
      return `${event} by ${actor}`;
    }

    return process.env.GITHUB_TRIGGERING_ACTOR || 'unknown';
  }

  private getWorkflowName(): string {
    return process.env.GITHUB_WORKFLOW || 'Playwright Tests';
  }
}

export default DashboardReporter;
```

### 3. Update Playwright Config (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test';

const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  testDir: './automation/playwright/tests',
  fullyParallel: true,
  forbidOnly: !!isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 4 : undefined,

  reporter: [
    // Always include these reporters
    ['html', { outputFolder: './automation/test-results/playwright-html-report' }],
    ['list'],
    ['json', { outputFile: './automation/test-results/playwright-results.json' }],

    // Dashboard reporter - CI only
    ...(isCI && process.env.DASHBOARD_URL ? [
      ['./automation/playwright/reporters/dashboard-reporter.ts', {
        endpoint: process.env.DASHBOARD_URL,
        apiKey: process.env.DASHBOARD_API_KEY,
        onlyOnFailure: true,
        includeArtifacts: true,
        maxArtifactSize: 5 * 1024 * 1024, // 5MB
      }]
    ] : []),
  ],

  use: {
    baseURL: process.env.FRONTEND_URL || 'https://app.attorneyshare.info',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // ... rest of config
});
```

---

## GitHub Actions Integration

### 4. Update GitHub Actions Workflow

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  CI: true
  DASHBOARD_URL: ${{ secrets.DASHBOARD_URL }}
  DASHBOARD_API_KEY: ${{ secrets.DASHBOARD_API_KEY }}

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run Playwright tests
        run: npx playwright test
        env:
          FRONTEND_URL: ${{ secrets.FRONTEND_URL }}
          BACKEND_URL: ${{ secrets.BACKEND_URL }}
          # Commit message for dashboard
          COMMIT_MESSAGE: ${{ github.event.head_commit.message }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: automation/test-results/
          retention-days: 7
```

### 5. Set GitHub Secrets

In your repository settings, add:

| Secret | Description |
|--------|-------------|
| `DASHBOARD_URL` | `https://your-dashboard.vercel.app` |
| `DASHBOARD_API_KEY` | Your API secret key |
| `FRONTEND_URL` | Frontend URL for tests |
| `BACKEND_URL` | Backend URL for tests |

---

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | string | `DASHBOARD_URL` env | Dashboard API URL |
| `apiKey` | string | `DASHBOARD_API_KEY` env | API authentication key |
| `onlyOnFailure` | boolean | `true` | Only send detailed logs for failures |
| `includeArtifacts` | boolean | `true` | Upload screenshots/traces |
| `maxArtifactSize` | number | `5MB` | Max artifact size in bytes |

---

## Behavior Matrix

| Scenario | Data Sent | Artifacts |
|----------|-----------|-----------|
| Test passes (CI) | Basic: name, duration, status | None |
| Test fails (CI) | Full: name, duration, status, error, logs | Screenshot, trace |
| Test skipped (CI) | Basic: name, status | None |
| Any test (Local) | None | None |

---

## Testing Checklist

- [ ] Reporter loads without errors
- [ ] Reporter only activates in CI (`CI=true`)
- [ ] Reporter skips when no endpoint configured
- [ ] Test results are collected correctly
- [ ] Failed tests include error message and stack trace
- [ ] Screenshots are base64 encoded correctly
- [ ] Traces are included for failures
- [ ] Large artifacts are skipped with warning
- [ ] API request includes proper authentication
- [ ] Success response is logged
- [ ] Error response is logged without crashing

### Local Testing

```bash
# Test reporter locally with CI mode
CI=true DASHBOARD_URL=http://localhost:3000 DASHBOARD_API_KEY=test npx playwright test --reporter=./automation/playwright/reporters/dashboard-reporter.ts
```

---

## Files to Create/Modify

### Create:
- `automation/playwright/reporters/dashboard-reporter.ts`

### Modify:
- `playwright.config.ts` - Add conditional reporter

### GitHub:
- Add secrets: `DASHBOARD_URL`, `DASHBOARD_API_KEY`
- Update workflow file if needed

---

## Troubleshooting

### Reporter not sending data

1. Check `CI=true` is set
2. Verify `DASHBOARD_URL` is configured
3. Check console for `[DashboardReporter]` messages

### Authentication errors

1. Verify `DASHBOARD_API_KEY` matches server's `API_SECRET_KEY`
2. Check for typos in environment variables

### Artifacts not uploading

1. Check `maxArtifactSize` limit
2. Verify `includeArtifacts: true`
3. Check if screenshot/trace were generated

### Large test suites timing out

1. Increase `maxDuration` on API route
2. Consider batching results
3. Reduce artifact size limit

---

## Next Steps

After completing this phase:
1. Run tests locally with `CI=true` to verify reporter
2. Push to branch and verify GitHub Actions workflow
3. Check dashboard for test results
4. Proceed to [Phase 03: TestLogger Service](./03-test-logger-service.md)

---

*Phase 02 Complete → Proceed to Phase 03: TestLogger Service*
